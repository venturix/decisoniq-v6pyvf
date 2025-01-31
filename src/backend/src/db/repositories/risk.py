"""
Repository module for managing risk assessment data access and persistence operations
in the Customer Success AI Platform with optimized query performance, comprehensive
error handling, and audit logging capabilities.

Version: SQLAlchemy 2.x
Redis 4.x
"""

import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
import json

from sqlalchemy import select, and_, desc
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from redis import Redis
from redis.exceptions import RedisError

from models.risk import RiskProfile
from core.exceptions import BaseCustomException
from db.session import get_db

# Configure module logger
logger = logging.getLogger(__name__)

# Constants
CACHE_TTL = 300  # 5 minutes cache TTL
MAX_RETRIES = 3
BATCH_SIZE = 100  # Batch size for bulk operations

# Error codes
REPO_ERROR_CODES = {
    'CACHE_ERROR': 'RISK001',
    'DB_ERROR': 'RISK002',
    'VALIDATION_ERROR': 'RISK003'
}

class RiskRepository:
    """
    Repository class for managing risk assessment data operations with caching
    and error handling capabilities.
    """

    def __init__(self, db_session: Session, cache_client: Redis):
        """
        Initialize risk repository with database session and cache client.

        Args:
            db_session: SQLAlchemy database session
            cache_client: Redis cache client
        """
        self._session = db_session
        self._cache = cache_client
        self._setup_logging()

    def _setup_logging(self) -> None:
        """Configure enhanced logging with metrics tracking."""
        self._metrics = {
            'cache_hits': 0,
            'cache_misses': 0,
            'db_queries': 0,
            'errors': 0
        }

    def _get_cache_key(self, customer_id: UUID) -> str:
        """Generate cache key for risk profile."""
        return f"risk_profile:{str(customer_id)}"

    def _cache_profile(self, profile: RiskProfile) -> None:
        """
        Cache risk profile with error handling.

        Args:
            profile: Risk profile to cache
        """
        try:
            cache_key = self._get_cache_key(profile.customer_id)
            profile_data = profile.to_dict()
            self._cache.setex(
                name=cache_key,
                time=CACHE_TTL,
                value=json.dumps(profile_data)
            )
        except RedisError as e:
            logger.error(f"Cache operation failed: {str(e)}")
            self._metrics['errors'] += 1

    def get_risk_profile(self, customer_id: UUID) -> Optional[RiskProfile]:
        """
        Retrieve risk profile by customer ID with caching.

        Args:
            customer_id: UUID of customer

        Returns:
            Optional[RiskProfile]: Risk profile if found, None otherwise

        Raises:
            BaseCustomException: On database or cache errors
        """
        try:
            # Check cache first
            cache_key = self._get_cache_key(customer_id)
            cached_data = self._cache.get(cache_key)

            if cached_data:
                self._metrics['cache_hits'] += 1
                profile_data = json.loads(cached_data)
                return RiskProfile(**profile_data)

            self._metrics['cache_misses'] += 1

            # Query database
            query = select(RiskProfile).where(
                and_(
                    RiskProfile.customer_id == customer_id,
                    RiskProfile.is_deleted == False
                )
            ).order_by(desc(RiskProfile.created_at))

            self._metrics['db_queries'] += 1
            profile = self._session.execute(query).scalars().first()

            if profile:
                self._cache_profile(profile)

            return profile

        except (SQLAlchemyError, RedisError) as e:
            self._metrics['errors'] += 1
            logger.error(f"Error retrieving risk profile: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to retrieve risk profile: {str(e)}",
                error_code=REPO_ERROR_CODES['DB_ERROR']
            )

    def create_risk_profile(
        self,
        customer_id: UUID,
        initial_score: float,
        risk_factors: Dict[str, Any]
    ) -> RiskProfile:
        """
        Create new risk profile with validation.

        Args:
            customer_id: UUID of customer
            initial_score: Initial risk score
            risk_factors: Dictionary of risk factors

        Returns:
            RiskProfile: Newly created risk profile

        Raises:
            BaseCustomException: On validation or database errors
        """
        try:
            # Validate input
            if not 0 <= initial_score <= 100:
                raise ValueError("Risk score must be between 0 and 100")

            # Create profile
            profile = RiskProfile(
                customer_id=customer_id,
                score=initial_score,
                factors=risk_factors
            )

            # Persist to database
            self._session.add(profile)
            self._session.commit()
            self._metrics['db_queries'] += 1

            # Update cache
            self._cache_profile(profile)

            logger.info(
                "Created new risk profile",
                extra={
                    "customer_id": str(customer_id),
                    "score": initial_score
                }
            )

            return profile

        except ValueError as e:
            raise BaseCustomException(
                message=str(e),
                error_code=REPO_ERROR_CODES['VALIDATION_ERROR']
            )
        except SQLAlchemyError as e:
            self._metrics['errors'] += 1
            self._session.rollback()
            logger.error(f"Failed to create risk profile: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to create risk profile: {str(e)}",
                error_code=REPO_ERROR_CODES['DB_ERROR']
            )

    def update_risk_score(
        self,
        customer_id: UUID,
        new_score: float,
        new_factors: Dict[str, Any]
    ) -> RiskProfile:
        """
        Update risk score with validation and caching.

        Args:
            customer_id: UUID of customer
            new_score: Updated risk score
            new_factors: Updated risk factors

        Returns:
            RiskProfile: Updated risk profile

        Raises:
            BaseCustomException: On validation or database errors
        """
        try:
            # Validate score
            if not 0 <= new_score <= 100:
                raise ValueError("Risk score must be between 0 and 100")

            # Get current profile
            profile = self.get_risk_profile(customer_id)
            if not profile:
                raise ValueError("Risk profile not found")

            # Update profile
            profile.score = new_score
            profile.factors = new_factors
            profile.updated_at = datetime.utcnow()

            # Persist changes
            self._session.commit()
            self._metrics['db_queries'] += 1

            # Invalidate and update cache
            cache_key = self._get_cache_key(customer_id)
            self._cache.delete(cache_key)
            self._cache_profile(profile)

            logger.info(
                "Updated risk profile",
                extra={
                    "customer_id": str(customer_id),
                    "new_score": new_score
                }
            )

            return profile

        except ValueError as e:
            raise BaseCustomException(
                message=str(e),
                error_code=REPO_ERROR_CODES['VALIDATION_ERROR']
            )
        except SQLAlchemyError as e:
            self._metrics['errors'] += 1
            self._session.rollback()
            logger.error(f"Failed to update risk profile: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to update risk profile: {str(e)}",
                error_code=REPO_ERROR_CODES['DB_ERROR']
            )

    def get_high_risk_customers(self, threshold: float = 75.0) -> List[RiskProfile]:
        """
        Retrieve high-risk profiles with optimization.

        Args:
            threshold: Risk score threshold (default: 75.0)

        Returns:
            List[RiskProfile]: List of high-risk profiles

        Raises:
            BaseCustomException: On database errors
        """
        try:
            # Validate threshold
            if not 0 <= threshold <= 100:
                raise ValueError("Threshold must be between 0 and 100")

            # Build optimized query
            query = (
                select(RiskProfile)
                .where(
                    and_(
                        RiskProfile.score >= threshold,
                        RiskProfile.is_deleted == False
                    )
                )
                .order_by(desc(RiskProfile.score))
            )

            # Execute query with pagination
            self._metrics['db_queries'] += 1
            profiles = self._session.execute(query).scalars().all()

            # Cache results
            for profile in profiles:
                self._cache_profile(profile)

            logger.info(
                "Retrieved high-risk profiles",
                extra={
                    "threshold": threshold,
                    "count": len(profiles)
                }
            )

            return profiles

        except SQLAlchemyError as e:
            self._metrics['errors'] += 1
            logger.error(f"Failed to retrieve high-risk profiles: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to retrieve high-risk profiles: {str(e)}",
                error_code=REPO_ERROR_CODES['DB_ERROR']
            )