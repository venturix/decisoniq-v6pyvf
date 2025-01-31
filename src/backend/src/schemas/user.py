"""
Pydantic schemas for user data validation and serialization in the Customer Success AI Platform.
Implements comprehensive request/response models with enhanced security features.

Version: Pydantic 2.x
"""

from datetime import datetime
from typing import Dict, List, Optional
import re
from pydantic import BaseModel, EmailStr, Field, validator, SecretStr
import pyotp  # v2.8.0+
from email_validator import validate_email, EmailNotValidError  # v2.0.0+

from models.user import User
from core.security import FieldEncryption

# Initialize field encryption
field_encryption = FieldEncryption()

# Constants for validation
PASSWORD_MIN_LENGTH = 12
PASSWORD_REGEX = r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{12,}$"
MFA_BACKUP_CODES_COUNT = 10
SESSION_TIMEOUT_MINUTES = 30
MAX_FAILED_ATTEMPTS = 5

class UserBase(BaseModel):
    """Base schema for user data with enhanced validation."""
    email: EmailStr = Field(..., description="User's email address")
    full_name: str = Field(..., min_length=2, max_length=100)
    roles: List[str] = Field(
        default=["cs_rep"],
        description="User roles for access control"
    )
    is_active: bool = Field(default=True)
    mfa_enabled: bool = Field(default=False)
    mfa_secret: Optional[str] = None
    mfa_backup_codes: List[str] = Field(default_factory=list)
    security_questions: Dict[str, str] = Field(default_factory=dict)
    failed_login_attempts: int = Field(default=0, ge=0, le=MAX_FAILED_ATTEMPTS)
    last_login: Optional[datetime] = None
    last_login_ip: Optional[str] = None

    @validator('email')
    def validate_email_format(cls, v):
        """Enhanced email validation with domain checks."""
        try:
            email_info = validate_email(v, check_deliverability=True)
            return email_info.normalized
        except EmailNotValidError as e:
            raise ValueError(f"Invalid email format: {str(e)}")

    @validator('roles')
    def validate_roles(cls, v):
        """Validate user roles against allowed values."""
        valid_roles = {"admin", "cs_manager", "cs_rep"}
        if not all(role in valid_roles for role in v):
            raise ValueError("Invalid role assignment")
        return v

    @validator('security_questions')
    def validate_security_questions(cls, v):
        """Validate security questions format and content."""
        if v and (len(v) < 2 or len(v) > 5):
            raise ValueError("Must provide between 2 and 5 security questions")
        return v

class UserCreate(UserBase):
    """Schema for user creation with password validation."""
    password: SecretStr = Field(..., min_length=PASSWORD_MIN_LENGTH)
    confirm_password: SecretStr = Field(..., min_length=PASSWORD_MIN_LENGTH)

    @validator('password')
    def validate_password_strength(cls, v):
        """Enforce strong password policy."""
        password = v.get_secret_value()
        if not re.match(PASSWORD_REGEX, password):
            raise ValueError(
                "Password must contain uppercase, lowercase, "
                "number and special character"
            )
        return v

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        """Ensure password confirmation matches."""
        if 'password' in values and v.get_secret_value() != values['password'].get_secret_value():
            raise ValueError("Passwords do not match")
        return v

class UserUpdate(BaseModel):
    """Schema for user updates with field-level encryption."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    roles: Optional[List[str]] = None
    is_active: Optional[bool] = None
    mfa_enabled: Optional[bool] = None
    security_questions: Optional[Dict[str, str]] = None

    @validator('roles')
    def validate_roles(cls, v):
        """Validate role updates."""
        if v is not None:
            valid_roles = {"admin", "cs_manager", "cs_rep"}
            if not all(role in valid_roles for role in v):
                raise ValueError("Invalid role assignment")
        return v

class UserLogin(BaseModel):
    """Schema for user login with rate limiting support."""
    email: EmailStr
    password: SecretStr
    mfa_code: Optional[str] = Field(None, min_length=6, max_length=6)
    device_id: Optional[str] = None
    ip_address: Optional[str] = None

    @validator('mfa_code')
    def validate_mfa_code(cls, v):
        """Validate MFA code format."""
        if v and not v.isdigit():
            raise ValueError("MFA code must contain only digits")
        return v

class UserResponse(BaseModel):
    """Schema for user data responses with sensitive field handling."""
    id: str
    email: str
    full_name: str
    roles: List[str]
    is_active: bool
    mfa_enabled: bool
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic configuration for response model."""
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class MFASetup(BaseModel):
    """Schema for MFA configuration."""
    enabled: bool = Field(default=False)
    secret: Optional[str] = None
    backup_codes: List[str] = Field(default_factory=list)
    recovery_email: Optional[EmailStr] = None

    @validator('backup_codes')
    def validate_backup_codes(cls, v):
        """Validate backup codes format and count."""
        if v and len(v) != MFA_BACKUP_CODES_COUNT:
            raise ValueError(f"Must provide exactly {MFA_BACKUP_CODES_COUNT} backup codes")
        return v

class PasswordReset(BaseModel):
    """Schema for password reset requests."""
    email: EmailStr
    reset_token: str
    new_password: SecretStr = Field(..., min_length=PASSWORD_MIN_LENGTH)
    confirm_password: SecretStr = Field(..., min_length=PASSWORD_MIN_LENGTH)

    @validator('new_password')
    def validate_password_strength(cls, v):
        """Enforce password policy for resets."""
        password = v.get_secret_value()
        if not re.match(PASSWORD_REGEX, password):
            raise ValueError(
                "Password must contain uppercase, lowercase, "
                "number and special character"
            )
        return v

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        """Verify password confirmation."""
        if 'new_password' in values and v.get_secret_value() != values['new_password'].get_secret_value():
            raise ValueError("Passwords do not match")
        return v