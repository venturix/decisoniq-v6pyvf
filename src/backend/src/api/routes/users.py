"""
User management router implementing secure endpoints with role-based access control,
field-level encryption, and comprehensive audit logging.

Version: FastAPI 0.100+
"""

import logging
from typing import Dict, List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import OAuth2PasswordBearer
from prometheus_client import Counter, Histogram
from redis import Redis
from pythonjsonlogger import jsonlogger

from models.user import User, ROLE_ADMIN, ROLE_CS_MANAGER, ROLE_CS_REP
from services.user import UserService
from core.security import FieldEncryption
from core.exceptions import (
    AuthenticationError,
    DataValidationError,
    BaseCustomException
)

# Configure logging
logger = logging.getLogger(__name__)
json_handler = logging.StreamHandler()
json_handler.setFormatter(jsonlogger.JsonFormatter())
logger.addHandler(json_handler)

# Initialize router
router = APIRouter(prefix="/users", tags=["users"])

# Initialize Redis cache
cache = Redis(host="localhost", port=6379, db=0)

# Initialize metrics
user_requests = Counter(
    "user_api_requests_total",
    "Total user API requests",
    ["endpoint", "method", "status"]
)
request_latency = Histogram(
    "user_api_request_duration_seconds",
    "User API request duration",
    ["endpoint"]
)

# Initialize security
field_encryption = FieldEncryption()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Rate limiting settings
RATE_LIMIT_WINDOW = 3600  # 1 hour
MAX_REQUESTS = 100

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    user_service: UserService = Depends()
) -> Dict:
    """Validate current user from token."""
    try:
        user = await user_service.validate_token(token)
        if not user:
            raise AuthenticationError(message="Invalid token")
        return user
    except Exception as e:
        logger.error(f"Token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

def check_permissions(required_roles: List[str]):
    """Validate user has required role."""
    async def permission_checker(
        current_user: Dict = Depends(get_current_user)
    ) -> bool:
        if not any(role in current_user["roles"] for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return True
    return permission_checker

@router.post("/", response_model=Dict)
async def create_user(
    user_data: Dict,
    current_user: Dict = Depends(get_current_user),
    user_service: UserService = Depends(),
    permissions: bool = Depends(check_permissions([ROLE_ADMIN]))
) -> Dict:
    """Create new user with role-based access control."""
    try:
        # Track metrics
        with request_latency.labels("/users").time():
            # Encrypt sensitive fields
            if "email" in user_data:
                user_data["email"] = field_encryption.encrypt(
                    user_data["email"].lower()
                )

            # Create user
            user = await user_service.create_user(
                email=user_data["email"],
                full_name=user_data["full_name"],
                password=user_data["password"],
                roles=user_data.get("roles", [ROLE_CS_REP])
            )

            # Log creation
            logger.info(
                "User created",
                extra={
                    "user_id": str(user.id),
                    "created_by": str(current_user["id"]),
                    "roles": user.roles
                }
            )

            user_requests.labels(
                endpoint="/users",
                method="POST",
                status=200
            ).inc()

            return user.to_dict(exclude_fields=["hashed_password"])

    except Exception as e:
        user_requests.labels(
            endpoint="/users",
            method="POST",
            status=500
        ).inc()
        logger.error(f"User creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

@router.get("/{user_id}", response_model=Dict)
async def get_user(
    user_id: UUID,
    current_user: Dict = Depends(get_current_user),
    user_service: UserService = Depends(),
    permissions: bool = Depends(check_permissions([ROLE_ADMIN, ROLE_CS_MANAGER]))
) -> Dict:
    """Retrieve user details with role-based access."""
    try:
        with request_latency.labels("/users/{user_id}").time():
            # Check cache
            cache_key = f"user:{str(user_id)}"
            cached_user = cache.get(cache_key)
            
            if cached_user:
                return eval(cached_user)

            # Get user from service
            user = await user_service.get_user(user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )

            # Cache result
            user_dict = user.to_dict(exclude_fields=["hashed_password"])
            cache.setex(cache_key, 300, str(user_dict))  # 5 minute cache

            user_requests.labels(
                endpoint="/users/{user_id}",
                method="GET",
                status=200
            ).inc()

            return user_dict

    except Exception as e:
        user_requests.labels(
            endpoint="/users/{user_id}",
            method="GET",
            status=500
        ).inc()
        logger.error(f"User retrieval failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user"
        )

@router.put("/{user_id}", response_model=Dict)
async def update_user(
    user_id: UUID,
    update_data: Dict,
    current_user: Dict = Depends(get_current_user),
    user_service: UserService = Depends(),
    permissions: bool = Depends(check_permissions([ROLE_ADMIN]))
) -> Dict:
    """Update user details with security controls."""
    try:
        with request_latency.labels("/users/{user_id}").time():
            # Encrypt sensitive fields
            if "email" in update_data:
                update_data["email"] = field_encryption.encrypt(
                    update_data["email"].lower()
                )

            # Update user
            updated_user = await user_service.update_user(
                user_id=user_id,
                update_data=update_data
            )

            if not updated_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )

            # Invalidate cache
            cache.delete(f"user:{str(user_id)}")

            # Log update
            logger.info(
                "User updated",
                extra={
                    "user_id": str(user_id),
                    "updated_by": str(current_user["id"]),
                    "updated_fields": list(update_data.keys())
                }
            )

            user_requests.labels(
                endpoint="/users/{user_id}",
                method="PUT",
                status=200
            ).inc()

            return updated_user.to_dict(exclude_fields=["hashed_password"])

    except Exception as e:
        user_requests.labels(
            endpoint="/users/{user_id}",
            method="PUT",
            status=500
        ).inc()
        logger.error(f"User update failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )

@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    current_user: Dict = Depends(get_current_user),
    user_service: UserService = Depends(),
    permissions: bool = Depends(check_permissions([ROLE_ADMIN]))
) -> Dict:
    """Delete user with audit logging."""
    try:
        with request_latency.labels("/users/{user_id}").time():
            # Delete user
            success = await user_service.delete_user(user_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )

            # Invalidate cache
            cache.delete(f"user:{str(user_id)}")

            # Log deletion
            logger.info(
                "User deleted",
                extra={
                    "user_id": str(user_id),
                    "deleted_by": str(current_user["id"])
                }
            )

            user_requests.labels(
                endpoint="/users/{user_id}",
                method="DELETE",
                status=200
            ).inc()

            return {"message": "User deleted successfully"}

    except Exception as e:
        user_requests.labels(
            endpoint="/users/{user_id}",
            method="DELETE",
            status=500
        ).inc()
        logger.error(f"User deletion failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )

@router.post("/{user_id}/mfa/setup", response_model=Dict)
async def setup_user_mfa(
    user_id: UUID,
    current_user: Dict = Depends(get_current_user),
    user_service: UserService = Depends(),
    permissions: bool = Depends(check_permissions([ROLE_ADMIN, ROLE_CS_MANAGER]))
) -> Dict:
    """Set up multi-factor authentication for user."""
    try:
        with request_latency.labels("/users/{user_id}/mfa/setup").time():
            # Setup MFA
            mfa_data = await user_service.setup_user_mfa(user_id)

            # Log MFA setup
            logger.info(
                "MFA setup completed",
                extra={
                    "user_id": str(user_id),
                    "setup_by": str(current_user["id"])
                }
            )

            user_requests.labels(
                endpoint="/users/{user_id}/mfa/setup",
                method="POST",
                status=200
            ).inc()

            return mfa_data

    except Exception as e:
        user_requests.labels(
            endpoint="/users/{user_id}/mfa/setup",
            method="POST",
            status=500
        ).inc()
        logger.error(f"MFA setup failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to setup MFA"
        )

@router.get("/team/{manager_id}", response_model=List[Dict])
async def get_team_users(
    manager_id: UUID,
    current_user: Dict = Depends(get_current_user),
    user_service: UserService = Depends(),
    permissions: bool = Depends(check_permissions([ROLE_ADMIN, ROLE_CS_MANAGER]))
) -> List[Dict]:
    """Retrieve team members for a manager."""
    try:
        with request_latency.labels("/users/team/{manager_id}").time():
            # Get team members
            team_users = await user_service.get_team_users(manager_id)

            user_requests.labels(
                endpoint="/users/team/{manager_id}",
                method="GET",
                status=200
            ).inc()

            return [
                user.to_dict(exclude_fields=["hashed_password"])
                for user in team_users
            ]

    except Exception as e:
        user_requests.labels(
            endpoint="/users/team/{manager_id}",
            method="GET",
            status=500
        ).inc()
        logger.error(f"Team users retrieval failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve team users"
        )