"""
Core authentication module for Customer Success AI Platform.
Implements Blitzy Enterprise SSO integration, token management, and authentication logic
with enhanced security protocols, audit logging, and session management.

Version: 1.0.0
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
import uuid
import json

from python3_saml import OneLogin_Saml2_Auth  # v1.15.0
from jose import jwt  # v3.3.0
from passlib.hash import argon2  # v1.7.4
import redis  # v7.x
import pyotp  # v2.8.0

from config.security import SecuritySettings
from models.user import User as UserModel
from core.exceptions import AuthenticationError, RateLimitError

# Configure logging
logger = logging.getLogger(__name__)

# Authentication constants
TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
PASSWORD_HASH_ROUNDS = 12
RATE_LIMIT_ATTEMPTS = 5
RATE_LIMIT_WINDOW = 300
MFA_CODE_LENGTH = 6

class BlitzyAuthManager:
    """
    Enhanced authentication manager implementing Blitzy Enterprise SSO,
    MFA, token management, and security protocols.
    """

    def __init__(
        self,
        security_settings: SecuritySettings,
        session_store: redis.Redis,
        rate_limiter: Any,
        audit_logger: Any
    ) -> None:
        """Initialize authentication manager with enhanced security features."""
        self.security_settings = security_settings
        self.session_store = session_store
        self.rate_limiter = rate_limiter
        self.audit_logger = audit_logger
        
        # Initialize SAML settings
        self.saml_settings = self._configure_saml()
        
        # Initialize token settings
        self.token_settings = security_settings.get_jwt_settings()
        
        # Initialize password hasher
        self.pwd_context = argon2.using(
            rounds=PASSWORD_HASH_ROUNDS,
            memory_cost=65536,
            parallelism=4
        )

        logger.info("BlitzyAuthManager initialized successfully")

    def authenticate_saml(self, saml_response: Dict, mfa_code: Optional[str] = None) -> Dict:
        """
        Handle SAML SSO authentication flow with MFA verification.
        
        Args:
            saml_response: SAML response from identity provider
            mfa_code: Optional MFA verification code
            
        Returns:
            Dict containing authentication result with tokens and session data
            
        Raises:
            AuthenticationError: If authentication fails
            RateLimitError: If rate limit exceeded
        """
        try:
            # Check rate limits
            if not self._check_rate_limit(saml_response.get("email")):
                raise RateLimitError(
                    message="Authentication rate limit exceeded",
                    rate_limit_context={
                        "window_seconds": RATE_LIMIT_WINDOW,
                        "max_attempts": RATE_LIMIT_ATTEMPTS
                    }
                )

            # Initialize SAML auth
            auth = OneLogin_Saml2_Auth(saml_response, self.saml_settings)
            
            # Validate SAML response
            if not auth.is_authenticated():
                raise AuthenticationError(
                    message="Invalid SAML authentication response",
                    auth_context={"saml_id": saml_response.get("id")}
                )

            # Extract user info
            user_info = auth.get_attributes()
            email = user_info.get("email")[0]
            
            # Get or create user
            user = self._get_or_create_user(email, user_info)
            
            # Verify MFA if enabled
            if user.mfa_enabled:
                if not mfa_code:
                    raise AuthenticationError(
                        message="MFA code required",
                        auth_context={"email": email}
                    )
                if not self.verify_mfa(str(user.id), mfa_code):
                    raise AuthenticationError(
                        message="Invalid MFA code",
                        auth_context={"email": email}
                    )

            # Generate tokens
            access_token = self._create_access_token(user)
            refresh_token = self._create_refresh_token(user)
            
            # Create session
            session_id = self._create_session(user, access_token)
            
            # Log successful authentication
            self.audit_logger.log_auth_success(
                user_id=str(user.id),
                auth_method="saml_sso",
                session_id=session_id
            )
            
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": TOKEN_EXPIRE_MINUTES * 60,
                "user": user.to_dict(exclude_fields=["hashed_password", "mfa_secret"]),
                "session_id": session_id
            }

        except Exception as e:
            logger.error(f"Authentication failed: {str(e)}")
            raise

    def verify_mfa(self, user_id: str, mfa_code: str) -> bool:
        """
        Verify MFA code for user authentication.
        
        Args:
            user_id: User ID
            mfa_code: MFA verification code
            
        Returns:
            bool indicating verification success
            
        Raises:
            AuthenticationError: If verification fails
        """
        try:
            # Validate code format
            if not mfa_code.isdigit() or len(mfa_code) != MFA_CODE_LENGTH:
                raise AuthenticationError(
                    message="Invalid MFA code format",
                    auth_context={"user_id": user_id}
                )

            # Get user
            user = UserModel.get_by_id(user_id)
            if not user or not user.mfa_enabled:
                raise AuthenticationError(
                    message="User not found or MFA not enabled",
                    auth_context={"user_id": user_id}
                )

            # Verify TOTP code
            totp = pyotp.TOTP(user.mfa_secret)
            is_valid = totp.verify(mfa_code)
            
            # Log verification attempt
            self.audit_logger.log_mfa_verification(
                user_id=user_id,
                success=is_valid
            )
            
            return is_valid

        except Exception as e:
            logger.error(f"MFA verification failed: {str(e)}")
            raise

    def _create_access_token(self, user: UserModel) -> str:
        """Create JWT access token for user."""
        expires_delta = timedelta(minutes=TOKEN_EXPIRE_MINUTES)
        expire = datetime.utcnow() + expires_delta
        
        token_data = {
            "sub": str(user.id),
            "exp": expire,
            "type": "access",
            "roles": user.roles,
            "jti": str(uuid.uuid4())
        }
        
        return jwt.encode(
            token_data,
            self.token_settings["secret_key"],
            algorithm=self.token_settings["algorithm"]
        )

    def _create_refresh_token(self, user: UserModel) -> str:
        """Create JWT refresh token for user."""
        expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        expire = datetime.utcnow() + expires_delta
        
        token_data = {
            "sub": str(user.id),
            "exp": expire,
            "type": "refresh",
            "jti": str(uuid.uuid4())
        }
        
        return jwt.encode(
            token_data,
            self.token_settings["secret_key"],
            algorithm=self.token_settings["algorithm"]
        )

    def _create_session(self, user: UserModel, access_token: str) -> str:
        """Create user session with metadata."""
        session_id = str(uuid.uuid4())
        session_data = {
            "user_id": str(user.id),
            "access_token": access_token,
            "created_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat(),
            "ip_address": None,  # Set by middleware
            "user_agent": None,  # Set by middleware
        }
        
        # Store session with expiration
        self.session_store.setex(
            f"session:{session_id}",
            TOKEN_EXPIRE_MINUTES * 60,
            json.dumps(session_data)
        )
        
        return session_id

    def _check_rate_limit(self, identifier: str) -> bool:
        """Check if rate limit is exceeded for identifier."""
        key = f"auth_rate_limit:{identifier}"
        current = self.rate_limiter.get_counter(key)
        
        if current >= RATE_LIMIT_ATTEMPTS:
            return False
            
        self.rate_limiter.increment(key, expire=RATE_LIMIT_WINDOW)
        return True

    def _configure_saml(self) -> Dict:
        """Configure SAML settings for Blitzy Enterprise SSO."""
        sso_config = self.security_settings.sso_config
        
        return {
            "strict": True,
            "debug": False,
            "sp": {
                "entityId": sso_config["sp_entity_id"],
                "assertionConsumerService": {
                    "url": sso_config["acs_url"],
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                },
                "singleLogoutService": {
                    "url": sso_config["sls_url"],
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                },
                "x509cert": sso_config["sp_x509cert"],
                "privateKey": sso_config["sp_private_key"]
            },
            "idp": {
                "entityId": sso_config["idp_entity_id"],
                "singleSignOnService": {
                    "url": sso_config["idp_sso_url"],
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                },
                "singleLogoutService": {
                    "url": sso_config["idp_sls_url"],
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                },
                "x509cert": sso_config["idp_x509cert"]
            },
            "security": {
                "nameIdEncrypted": True,
                "authnRequestsSigned": True,
                "logoutRequestSigned": True,
                "logoutResponseSigned": True,
                "signMetadata": True,
                "wantMessagesSigned": True,
                "wantAssertionsSigned": True,
                "wantNameIdEncrypted": True,
                "requestedAuthnContext": True,
                "wantAttributeStatement": True
            }
        }

    def _get_or_create_user(self, email: str, user_info: Dict) -> UserModel:
        """Get existing user or create new one from SAML attributes."""
        user = UserModel.get_by_email(email)
        
        if not user:
            user = UserModel(
                email=email,
                full_name=user_info.get("name")[0],
                roles=user_info.get("roles", ["cs_rep"]),
                mfa_enabled=True
            )
            user.save()
            
            logger.info(f"Created new user: {email}")
            
        return user