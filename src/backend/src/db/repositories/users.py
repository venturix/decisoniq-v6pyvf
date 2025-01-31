"""
User repository module for Customer Success AI Platform.
Implements secure user data access operations with caching, encryption and audit logging.

Version: SQLAlchemy 2.x
"""

import logging
import uuid
from typing import Optional, Dict, List
from datetime import datetime

from sqlalchemy import select, update, and_
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from redis import Redis

from models.user import User as UserModel
from db.session import get_db
from db.base import Base
from core.security import FieldEncryption
from core.exceptions import BaseCustomException

# Configure logging
logger = logging.getLogger(__name__)

# Cache configuration
CACHE_TTL = 300  # 5 minutes
CACHE_KEY_PREFIX = "user:"

# Error codes
USER_ERROR_CODES = {
    'NOT_FOUND': 'USER001',
    'CREATE_ERROR': 'USER002',
    'UPDATE_ERROR': 'USER003',
    'DELETE_ERROR': 'USER004',
    'VALIDATION_ERROR': 'USER005'
}

class UserRepository:
    """
    Repository class for user data access operations with enhanced security,
    caching, and performance optimization.
    """

    def __init__(self, db_session: Session, cache_client: Optional[Redis] = None):
        """
        Initialize user repository with database session and cache client.

        Args:
            db_session: SQLAlchemy database session
            cache_client: Redis cache client (optional)
        """
        self.db = db_session
        self.cache = cache_client
        self.field_encryption = FieldEncryption()
        
        # Configure query optimization settings
        self.db.execute("SET LOCAL statement_timeout = '3000ms'")  # 3s timeout per spec
        
        logger.info("UserRepository initialized with caching and encryption")

    def _get_cache_key(self, user_id: uuid.UUID) -> str:
        """Generate cache key for user data."""
        return f"{CACHE_KEY_PREFIX}{str(user_id)}"

    def _invalidate_cache(self, user_id: uuid.UUID) -> None:
        """Invalidate user cache entries."""
        if self.cache:
            cache_key = self._get_cache_key(user_id)
            self.cache.delete(cache_key)
            logger.debug(f"Cache invalidated for user {user_id}")

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[UserModel]:
        """
        Retrieve user by ID with caching and audit logging.

        Args:
            user_id: UUID of user to retrieve

        Returns:
            Optional[UserModel]: User if found, None otherwise

        Raises:
            BaseCustomException: On database or cache errors
        """
        try:
            # Check cache first
            if self.cache:
                cache_key = self._get_cache_key(user_id)
                cached_user = self.cache.get(cache_key)
                if cached_user:
                    logger.debug(f"Cache hit for user {user_id}")
                    return UserModel.parse_raw(cached_user)

            # Query database with optimized join
            query = select(UserModel).where(
                and_(
                    UserModel.id == user_id,
                    UserModel.is_deleted == False
                )
            ).execution_options(
                timeout=3  # 3s timeout per spec
            )
            
            user = self.db.execute(query).scalar_one_or_none()

            # Update cache if user found
            if user and self.cache:
                cache_key = self._get_cache_key(user_id)
                self.cache.setex(
                    cache_key,
                    CACHE_TTL,
                    user.json()
                )
                logger.debug(f"Cache updated for user {user_id}")

            return user

        except SQLAlchemyError as e:
            logger.error(f"Database error in get_by_id: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to retrieve user: {str(e)}",
                error_code=USER_ERROR_CODES['NOT_FOUND']
            )

    async def create(
        self,
        email: str,
        full_name: str,
        role: str,
        preferences: Optional[Dict] = None
    ) -> UserModel:
        """
        Create new user with encryption and validation.

        Args:
            email: User email address
            full_name: User full name
            role: User role
            preferences: Optional user preferences

        Returns:
            UserModel: Created user instance

        Raises:
            BaseCustomException: On validation or database errors
        """
        try:
            # Encrypt sensitive fields
            encrypted_email = self.field_encryption.encrypt(email.lower())

            # Create user instance
            user = UserModel(
                email=encrypted_email,
                full_name=full_name,
                role=role
            )

            if preferences:
                user.update_preferences(preferences)

            # Begin transaction
            self.db.begin()

            # Save to database
            self.db.add(user)
            self.db.flush()

            # Commit transaction
            self.db.commit()

            logger.info(
                f"User created successfully",
                extra={
                    "user_id": str(user.id),
                    "role": role
                }
            )

            return user

        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error in create: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to create user: {str(e)}",
                error_code=USER_ERROR_CODES['CREATE_ERROR']
            )

    async def update(
        self,
        user_id: uuid.UUID,
        update_data: Dict
    ) -> Optional[UserModel]:
        """
        Update user with validation and audit trail.

        Args:
            user_id: UUID of user to update
            update_data: Dictionary of fields to update

        Returns:
            Optional[UserModel]: Updated user if found

        Raises:
            BaseCustomException: On validation or database errors
        """
        try:
            # Begin transaction with row lock
            self.db.begin()

            # Get user with pessimistic lock
            query = select(UserModel).where(
                and_(
                    UserModel.id == user_id,
                    UserModel.is_deleted == False
                )
            ).with_for_update()
            
            user = self.db.execute(query).scalar_one_or_none()

            if not user:
                self.db.rollback()
                return None

            # Encrypt sensitive fields if present
            if 'email' in update_data:
                update_data['email'] = self.field_encryption.encrypt(
                    update_data['email'].lower()
                )

            # Update user fields
            for key, value in update_data.items():
                if hasattr(user, key):
                    setattr(user, key, value)

            # Save changes
            self.db.flush()

            # Commit transaction
            self.db.commit()

            # Invalidate cache
            self._invalidate_cache(user_id)

            logger.info(
                f"User updated successfully",
                extra={
                    "user_id": str(user_id),
                    "updated_fields": list(update_data.keys())
                }
            )

            return user

        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error in update: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to update user: {str(e)}",
                error_code=USER_ERROR_CODES['UPDATE_ERROR']
            )

    async def delete(self, user_id: uuid.UUID) -> bool:
        """
        Soft delete user with audit trail.

        Args:
            user_id: UUID of user to delete

        Returns:
            bool: True if deleted, False if not found

        Raises:
            BaseCustomException: On database errors
        """
        try:
            # Begin transaction
            self.db.begin()

            # Update user with soft delete
            result = self.db.execute(
                update(UserModel)
                .where(UserModel.id == user_id)
                .values(
                    is_deleted=True,
                    updated_at=datetime.utcnow()
                )
            )

            if result.rowcount == 0:
                self.db.rollback()
                return False

            # Commit transaction
            self.db.commit()

            # Invalidate cache
            self._invalidate_cache(user_id)

            logger.info(
                f"User deleted successfully",
                extra={"user_id": str(user_id)}
            )

            return True

        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error in delete: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to delete user: {str(e)}",
                error_code=USER_ERROR_CODES['DELETE_ERROR']
            )