"""
SQLAlchemy model for user management in the Customer Success AI Platform.
Implements secure user profile, authentication, and authorization with field encryption.

Version: SQLAlchemy 2.x
"""

from datetime import datetime, timedelta
import json
import logging
from typing import List, Optional, Dict, Any
import uuid

from sqlalchemy import Column, String, Boolean, JSON, Integer, DateTime, Index
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import validates
from passlib.hash import argon2

from models.base import BaseModel
from core.security import FieldEncryption
from core.exceptions import AuthenticationError

# Configure logging
logger = logging.getLogger(__name__)

# Initialize field encryption
field_encryption = FieldEncryption()

# Role constants
ROLE_ADMIN = "admin"
ROLE_CS_MANAGER = "cs_manager"
ROLE_CS_REP = "cs_rep"

# Authentication constants
MAX_AUTH_ATTEMPTS = 5
AUTH_LOCKOUT_DURATION = 300  # 5 minutes in seconds

class User(BaseModel):
    """
    Enhanced SQLAlchemy model for user management with advanced security features.
    Implements role-based access control, MFA, and field-level encryption.
    """

    __tablename__ = "users"

    # Core user fields with encryption for sensitive data
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    roles = Column(ARRAY(String), nullable=False, default=[])
    
    # Account status fields
    is_active = Column(Boolean, nullable=False, default=True)
    is_superuser = Column(Boolean, nullable=False, default=False)
    
    # Multi-factor authentication
    mfa_secret = Column(String, nullable=True)
    mfa_enabled = Column(Boolean, nullable=False, default=False)
    mfa_backup_codes = Column(ARRAY(String), nullable=True)
    
    # SSO integration
    blitzy_sso_id = Column(String, nullable=True, unique=True)
    
    # Security fields
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    lockout_until = Column(DateTime(timezone=True), nullable=True)
    security_questions = Column(JSON, nullable=True)
    last_password_change = Column(DateTime(timezone=True), nullable=False)
    
    # Session management
    session_data = Column(JSON, nullable=False, default=dict)

    # Optimized indexes
    __table_args__ = (
        Index('ix_users_email_active', 'email', 'is_active'),
        Index('ix_users_roles', 'roles', postgresql_using='gin'),
        {'extend_existing': True}
    )

    def __init__(
        self,
        email: str,
        full_name: str,
        password: str,
        roles: List[str],
        mfa_enabled: bool = False,
        security_questions: Optional[List[Dict[str, str]]] = None
    ) -> None:
        """Initialize user with enhanced security features."""
        super().__init__()
        
        # Encrypt sensitive fields
        self.email = field_encryption.encrypt(email.lower())
        self.full_name = full_name
        self.set_password(password)
        
        # Validate and set roles
        self.validate_roles(roles)
        self.roles = roles
        
        # Initialize MFA if enabled
        self.mfa_enabled = mfa_enabled
        if mfa_enabled:
            self.initialize_mfa()
        
        # Set security questions if provided
        self.security_questions = security_questions or []
        
        # Initialize session data
        self.session_data = {
            "last_login": None,
            "last_activity": None,
            "current_device": None
        }
        
        self.last_password_change = datetime.utcnow()
        
        # Log user creation
        logger.info(
            f"User created: {self.email}",
            extra={"user_id": str(self.id), "roles": self.roles}
        )

    def verify_password(self, plain_password: str) -> bool:
        """Verify password with rate limiting and lockout."""
        # Check if account is locked
        if self.is_locked_out():
            logger.warning(
                f"Login attempt for locked account: {self.email}",
                extra={"user_id": str(self.id)}
            )
            return False

        # Verify password
        is_valid = argon2.verify(plain_password, self.hashed_password)
        
        if not is_valid:
            self.failed_login_attempts += 1
            if self.failed_login_attempts >= MAX_AUTH_ATTEMPTS:
                self.lockout_until = datetime.utcnow() + timedelta(seconds=AUTH_LOCKOUT_DURATION)
                logger.warning(
                    f"Account locked due to failed attempts: {self.email}",
                    extra={"user_id": str(self.id)}
                )
        else:
            self.failed_login_attempts = 0
            self.lockout_until = None
            
        return is_valid

    def set_password(self, plain_password: str) -> None:
        """Set password with enhanced security requirements."""
        # Validate password complexity
        if not self._validate_password_complexity(plain_password):
            raise ValueError("Password does not meet security requirements")
        
        self.hashed_password = argon2.hash(plain_password)
        self.last_password_change = datetime.utcnow()
        
        logger.info(
            "Password updated",
            extra={"user_id": str(self.id)}
        )

    def verify_mfa(self, code: str, is_backup: bool = False) -> bool:
        """Verify MFA code or backup code."""
        if not self.mfa_enabled:
            return True
            
        if is_backup:
            if code in self.mfa_backup_codes:
                self.mfa_backup_codes.remove(code)
                logger.info(
                    "Backup MFA code used",
                    extra={"user_id": str(self.id)}
                )
                return True
            return False
            
        # Verify TOTP code using mfa_secret
        # Implementation depends on TOTP library choice
        return self._verify_totp(code)

    def has_role(self, role_name: str) -> bool:
        """Check if user has specific role with inheritance."""
        if self.is_superuser:
            return True
            
        if role_name in self.roles:
            return True
            
        # Role inheritance rules
        if role_name == ROLE_CS_REP and ROLE_CS_MANAGER in self.roles:
            return True
            
        return False

    @validates('roles')
    def validate_roles(self, roles: List[str]) -> List[str]:
        """Validate role assignments."""
        valid_roles = {ROLE_ADMIN, ROLE_CS_MANAGER, ROLE_CS_REP}
        if not all(role in valid_roles for role in roles):
            raise ValueError("Invalid role assignment")
        return roles

    def is_locked_out(self) -> bool:
        """Check if account is currently locked out."""
        if self.lockout_until and self.lockout_until > datetime.utcnow():
            return True
        return False

    def initialize_mfa(self) -> None:
        """Initialize MFA with backup codes."""
        # Generate TOTP secret
        self.mfa_secret = self._generate_totp_secret()
        
        # Generate backup codes
        self.mfa_backup_codes = [
            str(uuid.uuid4())[:8] for _ in range(10)
        ]

    def _validate_password_complexity(self, password: str) -> bool:
        """Validate password meets complexity requirements."""
        if len(password) < 12:
            return False
        if not any(c.isupper() for c in password):
            return False
        if not any(c.islower() for c in password):
            return False
        if not any(c.isdigit() for c in password):
            return False
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            return False
        return True

    def _verify_totp(self, code: str) -> bool:
        """Verify TOTP code."""
        # TOTP verification implementation
        # This would use a library like pyotp
        return True  # Placeholder

    def _generate_totp_secret(self) -> str:
        """Generate TOTP secret."""
        # TOTP secret generation implementation
        return str(uuid.uuid4())  # Placeholder