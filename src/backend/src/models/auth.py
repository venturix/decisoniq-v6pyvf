"""
Authentication and authorization models for Customer Success AI Platform.
Implements secure user authentication with Blitzy Enterprise SSO, MFA support,
field-level encryption, and comprehensive audit logging.

Version: SQLAlchemy 2.x
"""

from datetime import datetime, timedelta
import json
import uuid
from typing import Dict, List, Optional, Any

from sqlalchemy import (
    Column, String, Boolean, DateTime, JSON, ForeignKey, 
    UniqueConstraint, Index, event
)
from sqlalchemy.orm import validates, relationship, hybrid_property
from sqlalchemy.dialects.postgresql import UUID, JSONB
from passlib.hash import bcrypt

from models.base import BaseModel
from core.security import FieldEncryption

# Initialize field encryption
field_encryption = FieldEncryption()

# Security constants
PASSWORD_MIN_LENGTH = 12
SESSION_EXPIRY_HOURS = 24
MAX_FAILED_ATTEMPTS = 5
MFA_CODE_LENGTH = 6
BACKUP_CODES_COUNT = 10

class User(BaseModel):
    """
    SQLAlchemy model for user authentication and profile data with enhanced security.
    Implements secure field encryption and MFA support.
    """
    
    __tablename__ = 'users'

    # Core user fields with encryption for sensitive data
    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="User's email address (encrypted)"
    )
    full_name = Column(
        String(255),
        nullable=False,
        comment="User's full name"
    )
    hashed_password = Column(
        String(255),
        nullable=False,
        comment="Bcrypt hashed password"
    )
    roles = Column(
        JSONB,
        nullable=False,
        default=list,
        comment="User roles and permissions"
    )

    # Account status and security
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Account active status"
    )
    is_superuser = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Superuser status"
    )
    failed_login_attempts = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Failed login attempt counter"
    )
    last_login = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last successful login timestamp"
    )

    # MFA configuration
    mfa_secret = Column(
        String(255),
        nullable=True,
        comment="MFA secret key (encrypted)"
    )
    mfa_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="MFA status"
    )
    backup_codes = Column(
        JSONB,
        nullable=True,
        comment="Encrypted MFA backup codes"
    )

    # Security tracking
    allowed_ips = Column(
        JSONB,
        nullable=False,
        default=list,
        comment="Allowed IP addresses"
    )
    device_fingerprints = Column(
        JSONB,
        nullable=False,
        default=list,
        comment="Known device fingerprints"
    )
    security_questions = Column(
        JSONB,
        nullable=True,
        comment="Encrypted security questions and answers"
    )

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")

    def __init__(
        self,
        email: str,
        full_name: str,
        password: str,
        roles: List[str] = None,
        allowed_ips: List[str] = None
    ):
        """Initialize user with secure defaults and encrypted fields."""
        super().__init__()
        
        # Encrypt sensitive fields
        self.email = field_encryption.encrypt(email)
        self.full_name = full_name
        self.hashed_password = bcrypt.hash(password)
        self.roles = roles or ["user"]
        self.allowed_ips = allowed_ips or []
        
        # Security defaults
        self.is_active = True
        self.is_superuser = False
        self.failed_login_attempts = 0
        self.device_fingerprints = []
        self.security_questions = {}
        self.mfa_enabled = False

    @validates('email')
    def validate_email(self, key: str, email: str) -> str:
        """Validate email format before encryption."""
        if not email or '@' not in email:
            raise ValueError("Invalid email format")
        return email

    @validates('password')
    def validate_password(self, key: str, password: str) -> str:
        """Validate password strength."""
        if len(password) < PASSWORD_MIN_LENGTH:
            raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters")
        return password

    def verify_password(self, plain_password: str) -> bool:
        """
        Verify password with brute force protection.
        
        Args:
            plain_password: Password to verify
            
        Returns:
            bool: True if password matches
        """
        if self.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            lockout_time = datetime.utcnow() - timedelta(minutes=30)
            if not self.last_login or self.last_login < lockout_time:
                raise ValueError("Account temporarily locked due to failed attempts")

        try:
            is_valid = bcrypt.verify(plain_password, self.hashed_password)
            if is_valid:
                self.failed_login_attempts = 0
                self.last_login = datetime.utcnow()
            else:
                self.failed_login_attempts += 1
            return is_valid
        except Exception as e:
            self.failed_login_attempts += 1
            raise ValueError(f"Password verification failed: {str(e)}")

    def enable_mfa(self) -> tuple[str, List[str]]:
        """
        Enable MFA with backup codes.
        
        Returns:
            tuple: (MFA secret, backup codes list)
        """
        import pyotp
        import secrets

        # Generate and encrypt MFA secret
        mfa_secret = pyotp.random_base32()
        self.mfa_secret = field_encryption.encrypt(mfa_secret)
        
        # Generate and encrypt backup codes
        backup_codes = [
            secrets.token_hex(4) for _ in range(BACKUP_CODES_COUNT)
        ]
        self.backup_codes = [
            field_encryption.encrypt(code) for code in backup_codes
        ]
        
        self.mfa_enabled = True
        return mfa_secret, backup_codes

    def verify_mfa_code(self, code: str) -> bool:
        """
        Verify MFA code or backup code.
        
        Args:
            code: MFA code to verify
            
        Returns:
            bool: True if code is valid
        """
        if not self.mfa_enabled:
            return True

        import pyotp
        
        # Check regular MFA code
        decrypted_secret = field_encryption.decrypt(self.mfa_secret)
        totp = pyotp.TOTP(decrypted_secret)
        if totp.verify(code):
            return True
            
        # Check backup codes
        for idx, encrypted_code in enumerate(self.backup_codes):
            if field_encryption.decrypt(encrypted_code) == code:
                # Remove used backup code
                self.backup_codes.pop(idx)
                return True
                
        return False

class Session(BaseModel):
    """
    SQLAlchemy model for secure session management with device tracking.
    """
    
    __tablename__ = 'sessions'

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    token = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Session token"
    )
    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="Session expiration timestamp"
    )
    device_info = Column(
        String(255),
        nullable=False,
        comment="Encrypted device information"
    )
    ip_address = Column(
        String(45),
        nullable=False,
        comment="Client IP address"
    )
    device_fingerprint = Column(
        JSONB,
        nullable=False,
        comment="Device fingerprint data"
    )
    geo_location = Column(
        JSONB,
        nullable=True,
        comment="Geolocation data"
    )
    is_suspicious = Column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
        comment="Suspicious activity flag"
    )

    # Relationships
    user = relationship("User", back_populates="sessions")

    def __init__(
        self,
        user_id: uuid.UUID,
        device_info: str,
        ip_address: str,
        device_fingerprint: Dict
    ):
        """Initialize session with security tracking."""
        super().__init__()
        
        self.user_id = user_id
        self.token = secrets.token_urlsafe(32)
        self.expires_at = datetime.utcnow() + timedelta(hours=SESSION_EXPIRY_HOURS)
        self.device_info = field_encryption.encrypt(device_info)
        self.ip_address = ip_address
        self.device_fingerprint = device_fingerprint
        self.is_suspicious = False
        
        # Get geolocation data
        self.geo_location = self._get_geo_location(ip_address)

    @validates('ip_address')
    def validate_ip(self, key: str, ip: str) -> str:
        """Validate IP address format."""
        import ipaddress
        try:
            ipaddress.ip_address(ip)
            return ip
        except ValueError:
            raise ValueError("Invalid IP address format")

    def is_valid(self) -> bool:
        """
        Comprehensive session validation.
        
        Returns:
            bool: True if session is valid and secure
        """
        now = datetime.utcnow()
        
        # Check expiration
        if now >= self.expires_at:
            return False
            
        # Check suspicious activity
        if self.is_suspicious:
            return False
            
        # Validate device fingerprint
        stored_fp = self.user.device_fingerprints
        if self.device_fingerprint not in stored_fp:
            self.is_suspicious = True
            return False
            
        return True

    def _get_geo_location(self, ip_address: str) -> Optional[Dict]:
        """Get geolocation data for IP address."""
        try:
            import geoip2.database
            reader = geoip2.database.Reader('path/to/GeoLite2-City.mmdb')
            response = reader.city(ip_address)
            return {
                'country': response.country.name,
                'city': response.city.name,
                'latitude': response.location.latitude,
                'longitude': response.location.longitude
            }
        except Exception:
            return None

    def revoke(self) -> None:
        """Revoke session immediately."""
        self.expires_at = datetime.utcnow()
        self.is_suspicious = True

# Create indexes for performance
Index('ix_users_email_active', User.email, User.is_active)
Index('ix_sessions_user_expires', Session.user_id, Session.expires_at)

# Register event listeners
@event.listens_for(User, 'before_update')
def user_update_listener(mapper, connection, target):
    """Audit log user changes."""
    target.audit_log.append({
        'timestamp': datetime.utcnow().isoformat(),
        'type': 'UPDATE',
        'user_id': str(target.id)
    })