"""
Authentication router module implementing secure authentication endpoints with
comprehensive security controls, monitoring and rate limiting.

Version: 1.0.0
"""

import logging
from typing import Dict, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from prometheus_client import Counter, Histogram
from security_auditor import SecurityAuditor

from services.auth import AuthService
from services.metrics import MetricsCollector
from core.exceptions import AuthenticationError, RateLimitError
from models.user import User

# Configure logging
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/auth", tags=["auth"])

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize metrics
metrics = MetricsCollector(namespace="auth")
auth_attempts = Counter(
    "auth_attempts_total",
    "Total authentication attempts",
    ["method", "status"]
)
auth_latency = Histogram(
    "auth_latency_seconds",
    "Authentication request latency",
    ["method"]
)

# Initialize security auditor
auditor = SecurityAuditor(service="auth")

@router.post("/login")
@limiter.limit("5/minute")
@metrics.record_latency()
@auditor.log_auth_attempt()
async def login(
    request: Request,
    credentials: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends()
) -> Dict:
    """
    Authenticate user with email/password credentials.
    
    Args:
        request: FastAPI request object
        credentials: OAuth2 password credentials
        auth_service: Authentication service instance
        
    Returns:
        Dict containing authentication tokens and session data
        
    Raises:
        AuthenticationError: If authentication fails
        RateLimitError: If rate limit exceeded
    """
    try:
        # Record metrics
        auth_attempts.labels(method="password", status="attempt").inc()
        start_time = datetime.utcnow()

        # Get device info from request
        device_info = {
            "ip": request.client.host,
            "user_agent": request.headers.get("user-agent"),
            "device_id": request.headers.get("x-device-id")
        }

        # Authenticate user
        auth_result = await auth_service.login(
            credentials={"email": credentials.username, "password": credentials.password},
            device_info=device_info
        )

        # Record success metrics
        auth_attempts.labels(method="password", status="success").inc()
        auth_latency.labels(method="password").observe(
            (datetime.utcnow() - start_time).total_seconds()
        )

        return auth_result

    except (AuthenticationError, RateLimitError) as e:
        # Record failure metrics
        auth_attempts.labels(method="password", status="failure").inc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

@router.post("/sso/callback")
@metrics.record_latency()
@auditor.log_sso_attempt()
async def sso_login(
    request: Request,
    auth_service: AuthService = Depends()
) -> Dict:
    """
    Handle SSO authentication callback.
    
    Args:
        request: FastAPI request object
        auth_service: Authentication service instance
        
    Returns:
        Dict containing authentication tokens and session data
        
    Raises:
        AuthenticationError: If SSO authentication fails
    """
    try:
        # Record metrics
        auth_attempts.labels(method="sso", status="attempt").inc()
        start_time = datetime.utcnow()

        # Get SSO response data
        sso_data = await request.json()

        # Get device info
        device_info = {
            "ip": request.client.host,
            "user_agent": request.headers.get("user-agent"),
            "device_id": request.headers.get("x-device-id")
        }

        # Authenticate via SSO
        auth_result = await auth_service.sso_login(
            sso_data=sso_data,
            device_info=device_info
        )

        # Record success metrics
        auth_attempts.labels(method="sso", status="success").inc()
        auth_latency.labels(method="sso").observe(
            (datetime.utcnow() - start_time).total_seconds()
        )

        return auth_result

    except AuthenticationError as e:
        # Record failure metrics
        auth_attempts.labels(method="sso", status="failure").inc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

@router.post("/mfa/setup")
@metrics.record_latency()
async def setup_mfa(
    request: Request,
    auth_service: AuthService = Depends()
) -> Dict:
    """
    Set up multi-factor authentication for user.
    
    Args:
        request: FastAPI request object
        auth_service: Authentication service instance
        
    Returns:
        Dict containing MFA setup data
        
    Raises:
        AuthenticationError: If MFA setup fails
    """
    try:
        # Get authenticated user
        user_id = request.state.user_id

        # Set up MFA
        mfa_data = await auth_service.setup_mfa(user_id)
        
        logger.info(f"MFA setup completed for user {user_id}")
        return mfa_data

    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/mfa/verify")
@limiter.limit("3/minute")
@metrics.record_latency()
async def verify_mfa(
    request: Request,
    mfa_code: str,
    auth_service: AuthService = Depends()
) -> Dict:
    """
    Verify MFA code during authentication.
    
    Args:
        request: FastAPI request object
        mfa_code: MFA verification code
        auth_service: Authentication service instance
        
    Returns:
        Dict containing authentication result
        
    Raises:
        AuthenticationError: If MFA verification fails
        RateLimitError: If rate limit exceeded
    """
    try:
        # Get user ID from session
        user_id = request.state.user_id

        # Verify MFA code
        verification_result = await auth_service.verify_mfa(
            user_id=user_id,
            mfa_code=mfa_code
        )

        logger.info(f"MFA verification completed for user {user_id}")
        return verification_result

    except (AuthenticationError, RateLimitError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

@router.post("/logout")
@metrics.record_latency()
async def logout(
    request: Request,
    auth_service: AuthService = Depends()
) -> Dict:
    """
    Log out user and invalidate session.
    
    Args:
        request: FastAPI request object
        auth_service: Authentication service instance
        
    Returns:
        Dict containing logout status
        
    Raises:
        AuthenticationError: If logout fails
    """
    try:
        # Get session data
        session_id = request.headers.get("x-session-id")
        user_id = request.state.user_id

        # Perform logout
        await auth_service.logout(user_id=user_id, session_id=session_id)

        logger.info(f"Logout completed for user {user_id}")
        return {"status": "success", "message": "Logged out successfully"}

    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )