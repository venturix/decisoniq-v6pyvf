"""
Security configuration module for Customer Success AI Platform.
Provides comprehensive security settings, authentication parameters,
encryption configurations and compliance controls.

Version: 1.0.0
"""

from pydantic import BaseSettings, Field, SecretStr  # pydantic v2.x
from dotenv import load_dotenv  # python-dotenv v1.0.0
import os
from typing import Dict, List, Optional
import secrets
import base64

# Load environment variables with strict validation
load_dotenv(override=True)

# Security Constants
DEFAULT_ALGORITHM = "HS256"
DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = 30
DEFAULT_REFRESH_TOKEN_EXPIRE_DAYS = 7
ENCRYPTION_KEY_LENGTH = 32
MIN_PASSWORD_LENGTH = 12
MAX_LOGIN_ATTEMPTS = 5
SESSION_TIMEOUT_MINUTES = 60

# Secure Headers Default Configuration
SECURE_HEADERS = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none';"
}

class SecuritySettings(BaseSettings):
    """
    Comprehensive security configuration class managing authentication,
    encryption, compliance, and security protocol settings.
    """
    
    # Core Security Settings
    secret_key: SecretStr = Field(
        default_factory=lambda: SecretStr(base64.b64encode(secrets.token_bytes(32)).decode()),
        description="JWT signing key with high entropy"
    )
    algorithm: str = Field(
        default=DEFAULT_ALGORITHM,
        regex="^(HS256|HS384|HS512|RS256|RS384|RS512)$"
    )
    
    # Token Configuration
    access_token_expire_minutes: int = Field(
        default=DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES,
        ge=5,
        le=60
    )
    refresh_token_expire_days: int = Field(
        default=DEFAULT_REFRESH_TOKEN_EXPIRE_DAYS,
        ge=1,
        le=30
    )
    
    # Encryption Settings
    encryption_key: SecretStr = Field(
        default_factory=lambda: SecretStr(base64.b64encode(secrets.token_bytes(ENCRYPTION_KEY_LENGTH)).decode()),
        description="AES-256 encryption key"
    )
    
    # CORS Configuration
    allowed_origins: List[str] = Field(
        default_factory=lambda: [os.getenv("FRONTEND_URL", "http://localhost:3000")]
    )
    
    # SSL Configuration
    ssl_enabled: bool = Field(
        default=True,
        description="Enforce SSL/TLS connections"
    )
    
    # SSO Configuration
    sso_provider: str = Field(
        default="auth0",
        regex="^(auth0|okta|azure)$"
    )
    sso_config: Dict = Field(
        default_factory=lambda: {
            "domain": os.getenv("SSO_DOMAIN"),
            "client_id": os.getenv("SSO_CLIENT_ID"),
            "client_secret": os.getenv("SSO_CLIENT_SECRET"),
            "callback_url": os.getenv("SSO_CALLBACK_URL")
        }
    )
    
    # MFA Settings
    mfa_settings: Dict = Field(
        default_factory=lambda: {
            "enabled": True,
            "methods": ["totp", "sms"],
            "backup_codes": 10,
            "code_length": 6,
            "validity_period": 30
        }
    )
    
    # Encryption Configuration
    encryption_config: Dict = Field(
        default_factory=lambda: {
            "algorithm": "AES-256-GCM",
            "key_rotation_days": 90,
            "iv_length": 12,
            "tag_length": 16,
            "kdf_iterations": 100000
        }
    )
    
    # Compliance Settings
    compliance_settings: Dict = Field(
        default_factory=lambda: {
            "gdpr_enabled": True,
            "soc2_enabled": True,
            "iso27001_enabled": True,
            "data_retention_days": 365,
            "pii_encryption": True,
            "audit_logging": True
        }
    )
    
    # Audit Configuration
    audit_config: Dict = Field(
        default_factory=lambda: {
            "enabled": True,
            "log_level": "INFO",
            "retention_period_days": 365,
            "include_user_agent": True,
            "include_ip_address": True
        }
    )
    
    # Rate Limiting Configuration
    rate_limit_config: Dict = Field(
        default_factory=lambda: {
            "enabled": True,
            "max_requests": 100,
            "window_seconds": 60,
            "strategy": "sliding_window",
            "by_ip": True
        }
    )
    
    # Security Headers
    security_headers: Dict = Field(
        default=SECURE_HEADERS
    )

    def get_cors_config(self) -> Dict:
        """Returns enhanced CORS configuration with strict origin validation."""
        return {
            "allow_origins": self.allowed_origins,
            "allow_credentials": True,
            "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": [
                "Authorization",
                "Content-Type",
                "X-Request-ID",
                "X-Client-Version"
            ],
            "max_age": 3600,
            "expose_headers": ["X-Request-ID"]
        }

    def get_jwt_settings(self) -> Dict:
        """Returns comprehensive JWT configuration with enhanced security."""
        return {
            "secret_key": self.secret_key.get_secret_value(),
            "algorithm": self.algorithm,
            "access_token_expire_minutes": self.access_token_expire_minutes,
            "refresh_token_expire_days": self.refresh_token_expire_days,
            "token_type": "Bearer",
            "audience": os.getenv("JWT_AUDIENCE", "customer-success-ai"),
            "issuer": os.getenv("JWT_ISSUER", "blitzy-platform"),
            "blacklist_enabled": True,
            "blacklist_grace_period": 60
        }

    def get_encryption_config(self) -> Dict:
        """Returns enhanced encryption configuration with key rotation."""
        return {
            "key": self.encryption_key.get_secret_value(),
            "algorithm": self.encryption_config["algorithm"],
            "key_rotation_days": self.encryption_config["key_rotation_days"],
            "iv_length": self.encryption_config["iv_length"],
            "tag_length": self.encryption_config["tag_length"],
            "kdf_iterations": self.encryption_config["kdf_iterations"],
            "field_encryption": {
                "enabled": True,
                "fields": ["pii", "financial", "sensitive"]
            }
        }

    def get_compliance_settings(self) -> Dict:
        """Returns compliance configuration for various standards."""
        return {
            "gdpr": {
                "enabled": self.compliance_settings["gdpr_enabled"],
                "data_protection_officer": os.getenv("DPO_EMAIL"),
                "breach_notification_hours": 72,
                "consent_tracking": True
            },
            "soc2": {
                "enabled": self.compliance_settings["soc2_enabled"],
                "audit_logging": True,
                "access_review_days": 90,
                "incident_response_enabled": True
            },
            "iso27001": {
                "enabled": self.compliance_settings["iso27001_enabled"],
                "risk_assessment_interval_days": 180,
                "control_framework_version": "2013"
            },
            "audit": self.audit_config,
            "data_retention": {
                "enabled": True,
                "retention_days": self.compliance_settings["data_retention_days"],
                "backup_retention_days": 730
            }
        }

    class Config:
        """Pydantic configuration for SecuritySettings."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        validate_assignment = True
        extra = "forbid"