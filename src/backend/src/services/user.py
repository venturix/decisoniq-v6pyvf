"""
User service module implementing secure user management business logic for the 
Customer Success AI Platform with enhanced security, performance optimization, 
and comprehensive audit logging capabilities.

Version: 1.0.0
"""

import logging
from typing import Dict, List, Optional
import uuid
from datetime import datetime
from redis import Redis  # v4.5+
from fastapi import HTTPException, status
from pydantic import BaseModel, EmailStr  # v2.x
from cryptography.fernet import Fernet  # v41.0+

from models.user import User
from db.repositories.users import UserRepository
from services.auth import AuthService
from core.security import FieldEncryption
from core.exceptions import (
    AuthenticationError,
    DataValidationError,
    BaseCustomException
)

# Configure logging
logger = logging.getLogger(__name__)

# Cache configuration
CACHE_TTL = 300  # 5 minutes
MAX_LOGIN_ATTEMPTS = 5

# Error codes
USER_ERROR_CODES = {
    'VALIDATION': 'USER001',
    'NOT_FOUND': 'USER002',
    'CREATION': 'USER003',
    'UPDATE': 'USER004',
    'DELETION': 'USER005',
    'MFA': 'USER006'
}

class UserService:
    """
    Enhanced service class implementing secure user management with 
    performance optimization and comprehensive audit logging.
    """

    def __init__(
        self,
        user_repository: UserRepository,
        auth_service: AuthService,
        cache_client: Redis
    ) -> None:
        """
        Initialize user service with required dependencies.

        Args:
            user_repository: Repository for user data operations
            auth_service: Service for authentication operations
            cache_client: Redis client for caching
        """
        self.user_repository = user_repository
        self.auth_service = auth_service
        self.cache_client = cache_client
        self.field_encryption = FieldEncryption()

        logger.info("UserService initialized successfully")

    async def create_user(
        self,
        email: str,
        full_name: str,
        password: str,
        roles: List[str]
    ) -> User:
        """
        Create new user with enhanced security features.

        Args:
            email: User email address
            full_name: User full name
            password: User password
            roles: List of user roles

        Returns:
            User: Created user instance

        Raises:
            DataValidationError: If validation fails
            BaseCustomException: If user creation fails
        """
        try:
            # Validate email format
            if not EmailStr.validate(email):
                raise DataValidationError(
                    message="Invalid email format",
                    validation_errors={"email": ["Invalid email format"]}
                )

            # Check if email already exists
            cache_key = f"user_email:{email.lower()}"
            if self.cache_client.exists(cache_key):
                raise DataValidationError(
                    message="Email already registered",
                    validation_errors={"email": ["Email already in use"]}
                )

            # Encrypt sensitive data
            encrypted_email = self.field_encryption.encrypt(email.lower())
            
            # Create user instance
            user = User(
                email=encrypted_email,
                full_name=full_name,
                roles=roles,
                mfa_enabled=True  # Enable MFA by default
            )

            # Set secure password
            user.set_password(password)

            # Save user
            created_user = await self.user_repository.create(user)

            # Cache user data
            self._cache_user(created_user)

            # Log user creation
            logger.info(
                "User created successfully",
                extra={
                    "user_id": str(created_user.id),
                    "roles": roles
                }
            )

            return created_user

        except DataValidationError:
            raise
        except Exception as e:
            logger.error(f"User creation failed: {str(e)}")
            raise BaseCustomException(
                message="Failed to create user",
                error_code=USER_ERROR_CODES['CREATION']
            )

    async def setup_user_mfa(self, user_id: uuid.UUID) -> Dict:
        """
        Set up multi-factor authentication for user.

        Args:
            user_id: UUID of user

        Returns:
            Dict containing MFA setup data

        Raises:
            BaseCustomException: If MFA setup fails
        """
        try:
            # Get user from cache or database
            user = await self._get_user(user_id)
            if not user:
                raise BaseCustomException(
                    message="User not found",
                    error_code=USER_ERROR_CODES['NOT_FOUND']
                )

            # Generate MFA secret
            mfa_setup = await self.auth_service.setup_mfa(str(user_id))

            # Generate backup codes
            backup_codes = await self.auth_service.generate_backup_codes()

            # Update user with MFA data
            update_data = {
                "mfa_secret": self.field_encryption.encrypt(mfa_setup["secret"]),
                "mfa_enabled": True,
                "backup_codes": [
                    self.field_encryption.encrypt(code) 
                    for code in backup_codes
                ]
            }

            # Update user
            updated_user = await self.user_repository.update(
                user_id,
                update_data
            )

            # Invalidate cache
            self._invalidate_user_cache(user_id)

            # Log MFA setup
            logger.info(
                "MFA setup completed",
                extra={
                    "user_id": str(user_id),
                    "mfa_type": "totp"
                }
            )

            return {
                "secret": mfa_setup["secret"],
                "qr_code": mfa_setup["qr_code"],
                "backup_codes": backup_codes
            }

        except Exception as e:
            logger.error(f"MFA setup failed: {str(e)}")
            raise BaseCustomException(
                message="Failed to setup MFA",
                error_code=USER_ERROR_CODES['MFA']
            )

    async def _get_user(self, user_id: uuid.UUID) -> Optional[User]:
        """Get user from cache or database."""
        # Try cache first
        cache_key = f"user:{str(user_id)}"
        cached_user = self.cache_client.get(cache_key)
        
        if cached_user:
            return User.parse_raw(cached_user)

        # Get from database
        user = await self.user_repository.get_by_id(user_id)
        if user:
            self._cache_user(user)
        
        return user

    def _cache_user(self, user: User) -> None:
        """Cache user data with encryption."""
        cache_key = f"user:{str(user.id)}"
        self.cache_client.setex(
            cache_key,
            CACHE_TTL,
            user.json(exclude={'hashed_password', 'mfa_secret'})
        )

        # Cache email lookup
        email_key = f"user_email:{user.email}"
        self.cache_client.setex(
            email_key,
            CACHE_TTL,
            str(user.id)
        )

    def _invalidate_user_cache(self, user_id: uuid.UUID) -> None:
        """Invalidate user cache entries."""
        cache_key = f"user:{str(user_id)}"
        self.cache_client.delete(cache_key)