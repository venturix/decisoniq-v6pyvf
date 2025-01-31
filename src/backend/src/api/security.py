"""
API security module for Customer Success AI Platform.
Implements comprehensive authentication middleware, security dependencies,
and request/response security handling with enhanced audit logging.

Version: 1.0.0
"""

from typing import Dict, Optional, Any
import logging
from datetime import datetime

from fastapi import Depends, HTTPException, Security
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware

from core.auth import BlitzyAuthManager
from config.security import SecuritySettings
from core.security import FieldEncryption
from core.exceptions import AuthenticationError, RateLimitError

# Configure logging
logger = logging.getLogger(__name__)

# Initialize OAuth2 scheme with scopes
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="auth/token",
    auto_error=True,
    scopes={
        "admin": "Admin access",
        "cs_manager": "CS Manager access",
        "cs_rep": "CS Representative access"
    }
)

# Initialize field encryption
field_encryption = FieldEncryption()

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    mfa_code: Optional[str] = None,
    security_settings: SecuritySettings = Depends()
) -> Dict[str, Any]:
    """
    Enhanced dependency function to get current authenticated user from token with MFA validation.

    Args:
        token: JWT access token
        mfa_code: Optional MFA verification code
        security_settings: Security configuration settings

    Returns:
        Dict containing user information with role and permissions

    Raises:
        AuthenticationError: If authentication fails
    """
    try:
        # Initialize auth manager
        auth_manager = BlitzyAuthManager(
            security_settings=security_settings,
            session_store=None,  # Injected by middleware
            rate_limiter=None,  # Injected by middleware
            audit_logger=None  # Injected by middleware
        )

        # Verify token format
        if not token or "." not in token:
            raise AuthenticationError(
                message="Invalid token format",
                auth_context={"token_type": "access"}
            )

        # Verify token and get user data
        user_data = auth_manager.verify_token(token)

        # Validate MFA if enabled
        if user_data.get("mfa_enabled") and not auth_manager.verify_mfa(
            str(user_data["id"]),
            mfa_code
        ):
            raise AuthenticationError(
                message="Invalid MFA code",
                auth_context={"user_id": str(user_data["id"])}
            )

        # Log successful authentication
        logger.info(
            "User authenticated successfully",
            extra={
                "user_id": str(user_data["id"]),
                "roles": user_data.get("roles", [])
            }
        )

        return user_data

    except AuthenticationError as e:
        logger.error(f"Authentication failed: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during authentication: {str(e)}")
        raise AuthenticationError(
            message="Authentication failed",
            auth_context={"error": str(e)}
        )

async def verify_admin(
    current_user: Dict = Depends(get_current_user)
) -> Dict:
    """
    Enhanced dependency function to verify admin role access with inheritance.

    Args:
        current_user: Current authenticated user information

    Returns:
        Dict containing user information with validated admin permissions

    Raises:
        AuthenticationError: If user lacks admin privileges
    """
    try:
        # Check admin role
        if "admin" not in current_user.get("roles", []):
            raise AuthenticationError(
                message="Admin privileges required",
                auth_context={
                    "user_id": str(current_user["id"]),
                    "roles": current_user.get("roles", [])
                }
            )

        # Log admin access
        logger.info(
            "Admin access granted",
            extra={
                "user_id": str(current_user["id"]),
                "access_type": "admin"
            }
        )

        return current_user

    except Exception as e:
        logger.error(f"Admin verification failed: {str(e)}")
        raise AuthenticationError(
            message="Admin verification failed",
            auth_context={"error": str(e)}
        )

class SecurityMiddleware:
    """
    Enhanced middleware for comprehensive request/response security handling.
    Implements rate limiting, field encryption, and security headers.
    """

    def __init__(self, security_settings: SecuritySettings):
        """Initialize security middleware with enhanced features."""
        self.security_settings = security_settings
        self.field_encryption = field_encryption
        self.rate_limiter = None  # Initialized during startup
        
        # Configure security headers
        self.security_headers = security_settings.security_headers
        
        # Configure CORS
        self.cors_config = security_settings.get_cors_config()
        
        logger.info("Security middleware initialized successfully")

    async def process_request(self, request: Any) -> Any:
        """
        Process incoming request security with enhanced validation.

        Args:
            request: FastAPI request object

        Returns:
            Processed request with security context

        Raises:
            RateLimitError: If rate limit exceeded
        """
        try:
            # Apply rate limiting
            if self.rate_limiter and not self._check_rate_limit(request):
                raise RateLimitError(
                    message="Rate limit exceeded",
                    rate_limit_context=self.security_settings.rate_limit_config
                )

            # Validate request headers
            self._validate_headers(request)

            # Add security context
            request.state.security_context = {
                "timestamp": datetime.utcnow().isoformat(),
                "client_ip": request.client.host,
                "user_agent": request.headers.get("user-agent"),
                "request_id": request.headers.get("x-request-id")
            }

            # Decrypt sensitive fields if present
            if request.method in ["POST", "PUT", "PATCH"]:
                await self._decrypt_request_data(request)

            return request

        except Exception as e:
            logger.error(f"Request processing failed: {str(e)}")
            raise

    async def process_response(self, response: Any) -> Any:
        """
        Process outgoing response security with enhanced protection.

        Args:
            response: FastAPI response object

        Returns:
            Processed response with security headers
        """
        try:
            # Add security headers
            for header, value in self.security_headers.items():
                response.headers[header] = value

            # Add content security policy
            response.headers["Content-Security-Policy"] = self._get_csp_header()

            # Encrypt sensitive fields in response
            await self._encrypt_response_data(response)

            return response

        except Exception as e:
            logger.error(f"Response processing failed: {str(e)}")
            raise

    def _check_rate_limit(self, request: Any) -> bool:
        """Check if request exceeds rate limit."""
        if not self.rate_limiter:
            return True

        key = f"rate_limit:{request.client.host}"
        return self.rate_limiter.check_limit(key)

    def _validate_headers(self, request: Any) -> None:
        """Validate required security headers."""
        required_headers = {
            "x-request-id": "Request ID required",
            "x-client-version": "Client version required"
        }

        for header, message in required_headers.items():
            if header not in request.headers:
                raise HTTPException(status_code=400, detail=message)

    async def _decrypt_request_data(self, request: Any) -> None:
        """Decrypt sensitive fields in request data."""
        if hasattr(request, "body"):
            data = await request.json()
            for field in self.security_settings.encryption_config["field_encryption"]["fields"]:
                if field in data:
                    data[field] = self.field_encryption.decrypt(data[field])
            request._body = data

    async def _encrypt_response_data(self, response: Any) -> None:
        """Encrypt sensitive fields in response."""
        if hasattr(response, "body"):
            data = response.body
            for field in self.security_settings.encryption_config["field_encryption"]["fields"]:
                if field in data:
                    data[field] = self.field_encryption.encrypt(data[field])
            response._body = data

    def _get_csp_header(self) -> str:
        """Generate Content Security Policy header."""
        return "; ".join([
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ])