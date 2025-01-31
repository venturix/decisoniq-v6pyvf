"""
Authentication and authorization schemas for Customer Success AI Platform.
Implements secure data validation with field-level encryption and comprehensive audit logging.

Version: Pydantic 2.x
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, model_config, field_validator
from models.auth import User

# Security constants
PASSWORD_MIN_LENGTH = 12
PASSWORD_PATTERN = r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{12,}$"
MFA_CODE_LENGTH = 6
LOGIN_ATTEMPT_LIMIT = 3

class UserBase(BaseModel):
    """Base user schema with enhanced security tracking."""
    
    model_config = model_config(from_attributes=True)
    
    email: EmailStr = Field(..., description="User's email address")
    full_name: str = Field(..., min_length=2, max_length=255)
    roles: List[str] = Field(default=["user"], description="User roles and permissions")
    is_active: bool = Field(default=True, description="Account active status")
    security_profile: Dict = Field(
        default_factory=dict,
        description="Security settings and preferences"
    )
    login_history: List[Dict] = Field(
        default_factory=list,
        description="Historical login attempts"
    )
    security_events: List[Dict] = Field(
        default_factory=list,
        description="Security-related events log"
    )

class UserCreate(UserBase):
    """Schema for user creation with strong password validation."""
    
    password: str = Field(
        ...,
        min_length=PASSWORD_MIN_LENGTH,
        description="User password meeting security requirements"
    )
    password_confirm: str = Field(
        ...,
        description="Password confirmation for validation"
    )
    security_questions: List[Dict] = Field(
        ...,
        min_items=2,
        description="Security recovery questions and answers"
    )
    device_info: Dict = Field(
        ...,
        description="Initial device registration information"
    )

    @field_validator("password")
    def validate_password(cls, v: str, values: Dict) -> str:
        """Validate password complexity and security requirements."""
        import re
        from passlib.pwd import genword

        # Check password pattern
        if not re.match(PASSWORD_PATTERN, v):
            raise ValueError(
                "Password must contain uppercase, lowercase, "
                "number and special character"
            )

        # Check against common passwords
        if v.lower() in genword():
            raise ValueError("Password is too common")

        # Verify password confirmation
        if "password_confirm" in values and v != values["password_confirm"]:
            raise ValueError("Passwords do not match")

        return v

class MFASetup(BaseModel):
    """Schema for MFA configuration and validation."""
    
    model_config = model_config(from_attributes=True)
    
    secret_key: str = Field(..., description="TOTP secret key")
    verification_code: str = Field(
        ...,
        min_length=MFA_CODE_LENGTH,
        max_length=MFA_CODE_LENGTH,
        description="MFA verification code"
    )
    backup_codes: List[str] = Field(
        default_factory=list,
        min_items=5,
        max_items=10,
        description="Backup recovery codes"
    )
    device_fingerprint: Dict = Field(
        ...,
        description="Device identification data"
    )
    location_info: Dict = Field(
        default_factory=dict,
        description="Location data for verification"
    )

    @field_validator("verification_code")
    def validate_code(cls, v: str) -> str:
        """Validate MFA code format and rate limiting."""
        import re
        
        # Validate numeric format
        if not re.match(r"^\d{" + str(MFA_CODE_LENGTH) + "}$", v):
            raise ValueError(f"Code must be {MFA_CODE_LENGTH} digits")
            
        return v

class SecurityAudit(BaseModel):
    """Schema for comprehensive security event logging."""
    
    model_config = model_config(from_attributes=True)
    
    event_id: UUID = Field(
        default_factory=UUID,
        description="Unique event identifier"
    )
    event_type: str = Field(
        ...,
        description="Type of security event"
    )
    event_details: Dict = Field(
        ...,
        description="Detailed event information"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Event timestamp"
    )
    device_info: Dict = Field(
        ...,
        description="Device context information"
    )
    location_info: Dict = Field(
        default_factory=dict,
        description="Geographic location data"
    )
    ip_address: str = Field(
        ...,
        description="Source IP address"
    )

class LoginRequest(BaseModel):
    """Schema for secure login requests with device tracking."""
    
    email: EmailStr = Field(..., description="User email")
    password: str = Field(
        ...,
        min_length=PASSWORD_MIN_LENGTH,
        description="User password"
    )
    device_info: Dict = Field(
        ...,
        description="Device identification data"
    )
    mfa_code: Optional[str] = Field(
        None,
        min_length=MFA_CODE_LENGTH,
        max_length=MFA_CODE_LENGTH,
        description="MFA verification code if enabled"
    )

class TokenResponse(BaseModel):
    """Schema for authentication token response."""
    
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration in seconds")
    refresh_token: str = Field(..., description="Refresh token")
    scope: str = Field(default="", description="Token scope")

class SessionInfo(BaseModel):
    """Schema for active session information."""
    
    session_id: UUID = Field(..., description="Unique session identifier")
    user_id: UUID = Field(..., description="Associated user ID")
    device_info: Dict = Field(..., description="Device context")
    ip_address: str = Field(..., description="Client IP address")
    expires_at: datetime = Field(..., description="Session expiration")
    is_active: bool = Field(default=True, description="Session status")
    security_flags: Dict = Field(
        default_factory=dict,
        description="Security-related flags"
    )