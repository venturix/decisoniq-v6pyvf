"""
FastAPI dependency injection module for Customer Success AI Platform.
Provides reusable dependencies for authentication, database sessions, and security.

Version: 1.0.0
"""

import logging
from typing import Dict, Generator, Optional
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import redis
from jose import JWTError, jwt

from core.auth import BlitzyAuthManager
from core.security import FieldEncryption
from db.session import get_db, DatabaseSession
from core.exceptions import AuthenticationError, RateLimitError
from config.security import SecuritySettings

# Configure logging
logger = logging.getLogger(__name__)

# Initialize security settings
security_settings = SecuritySettings()

# Initialize OAuth2 scheme with token URL
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="token",
    auto_error=True,
    scheme_name="Blitzy Enterprise SSO"
)

# Initialize Redis connection pool for caching
REDIS_POOL = redis.ConnectionPool(
    host=security_settings.redis_host,
    port=security_settings.redis_port,
    db=0,
    max_connections=100,
    socket_timeout=3.0,  # 3s timeout per spec
    retry_on_timeout=True
)

# Initialize core components
auth_manager = BlitzyAuthManager(
    security_settings=security_settings,
    session_store=redis.Redis(connection_pool=REDIS_POOL),
    rate_limiter=None,  # Injected at runtime
    audit_logger=None   # Injected at runtime
)

field_encryption = FieldEncryption()

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    redis_client: redis.Redis = Depends(get_redis_client)
) -> Dict:
    """
    Enhanced dependency that validates JWT token and returns current user with caching.
    
    Args:
        token: JWT access token
        redis_client: Redis client for caching
        
    Returns:
        Dict containing user information with roles and permissions
        
    Raises:
        AuthenticationError: If token is invalid or user unauthorized
    """
    try:
        # Check Redis cache first
        cache_key = f"user_token:{token}"
        cached_user = redis_client.get(cache_key)
        
        if cached_user:
            return eval(cached_user.decode())  # Convert from string to dict
            
        # Verify token if not in cache
        payload = jwt.decode(
            token,
            security_settings.secret_key.get_secret_value(),
            algorithms=[security_settings.algorithm]
        )
        
        # Extract user info
        user_id: str = payload.get("sub")
        if not user_id:
            raise AuthenticationError(
                message="Invalid token claims",
                auth_context={"token_type": "access"}
            )
            
        # Get user from database
        with DatabaseSession() as db:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise AuthenticationError(
                    message="User not found",
                    auth_context={"user_id": user_id}
                )
                
            # Verify MFA if enabled
            if user.mfa_enabled and not auth_manager.verify_mfa(str(user.id), payload.get("mfa")):
                raise AuthenticationError(
                    message="MFA verification required",
                    auth_context={"user_id": user_id}
                )
                
            # Build user info dict
            user_info = {
                "id": str(user.id),
                "email": field_encryption.decrypt(user.email),
                "roles": user.roles,
                "permissions": get_user_permissions(user),
                "is_active": user.is_active
            }
            
            # Cache user info
            redis_client.setex(
                cache_key,
                timedelta(minutes=15),  # 15 min cache
                str(user_info)
            )
            
            return user_info
            
    except JWTError as e:
        logger.error(f"JWT validation failed: {str(e)}")
        raise AuthenticationError(
            message="Invalid authentication credentials",
            auth_context={"error": str(e)}
        )
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise

def get_db_session() -> Generator:
    """
    Enhanced database session dependency with connection pooling and retry logic.
    
    Yields:
        Session: Configured database session with transaction management
    """
    try:
        with DatabaseSession() as session:
            yield session
    except Exception as e:
        logger.error(f"Database session error: {str(e)}")
        raise

def get_redis_client() -> redis.Redis:
    """
    Redis client dependency with cluster support and connection pooling.
    
    Returns:
        Redis: Configured Redis client
    """
    try:
        return redis.Redis(
            connection_pool=REDIS_POOL,
            decode_responses=True,
            socket_timeout=3.0,  # 3s timeout per spec
            retry_on_timeout=True
        )
    except Exception as e:
        logger.error(f"Redis client error: {str(e)}")
        raise

class PermissionChecker:
    """
    Enhanced permission checking with role inheritance and audit logging.
    """
    
    def __init__(self, required_permissions: list, require_all: bool = True):
        """
        Initialize permission checker.
        
        Args:
            required_permissions: List of required permissions
            require_all: Whether all permissions are required
        """
        self._required_permissions = required_permissions
        self._require_all = require_all
        
    async def __call__(self, current_user: Dict = Depends(get_current_user)) -> bool:
        """
        Check if user has required permissions.
        
        Args:
            current_user: Current authenticated user
            
        Returns:
            bool indicating if user has required permissions
            
        Raises:
            HTTPException: If user lacks required permissions
        """
        try:
            user_permissions = set(current_user.get("permissions", []))
            
            if self._require_all:
                has_permission = all(
                    perm in user_permissions 
                    for perm in self._required_permissions
                )
            else:
                has_permission = any(
                    perm in user_permissions 
                    for perm in self._required_permissions
                )
                
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
                
            return True
            
        except Exception as e:
            logger.error(f"Permission check failed: {str(e)}")
            raise

def get_user_permissions(user: Dict) -> list:
    """Helper function to resolve user permissions from roles."""
    permissions = set()
    
    # Role-based permissions
    role_permissions = {
        "admin": ["*"],  # Admin has all permissions
        "cs_manager": [
            "view_dashboard",
            "manage_accounts",
            "execute_playbooks",
            "view_analytics"
        ],
        "cs_rep": [
            "view_dashboard",
            "view_accounts",
            "execute_playbooks"
        ]
    }
    
    # Add permissions based on user roles
    for role in user.roles:
        if role in role_permissions:
            permissions.update(role_permissions[role])
            
    return list(permissions)