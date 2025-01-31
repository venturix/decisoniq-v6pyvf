"""
Repository module implementing data access patterns for customer entities in the Customer Success AI Platform.
Provides optimized query performance, caching, and security measures for customer data operations.

Version: SQLAlchemy 2.x
"""

import logging
from typing import Dict, List, Optional, Union
from uuid import UUID
import json

from sqlalchemy import select, update, delete, and_, or_, desc
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from models.customer import Customer
from db.session import get_db
from core.exceptions import BaseCustomException

# Configure module logger
logger = logging.getLogger(__name__)

# Constants
CACHE_TTL = 300  # 5 minutes cache TTL
MAX_RETRY_ATTEMPTS = 3
DEFAULT_RISK_THRESHOLD = 80.0

class CustomerRepository:
    """Repository implementing optimized data access patterns for customer entities with caching and security."""

    def __init__(self, db_session: Session, cache_client=None):
        """
        Initialize repository with database session and cache configuration.
        
        Args:
            db_session: SQLAlchemy session
            cache_client: Redis cache client (optional)
        """
        self.db = db_session
        self.cache = cache_client
        self._setup_logging()

    def _setup_logging(self):
        """Configure repository-specific logging."""
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    def _get_cache_key(self, customer_id: UUID) -> str:
        """Generate cache key for customer data."""
        return f"customer:{str(customer_id)}"

    async def get_by_id(self, customer_id: UUID) -> Optional[Customer]:
        """
        Retrieve customer by ID with caching.
        
        Args:
            customer_id: UUID of customer to retrieve
            
        Returns:
            Optional[Customer]: Customer if found, None otherwise
        """
        try:
            # Check cache first
            if self.cache:
                cache_key = self._get_cache_key(customer_id)
                cached_data = await self.cache.get(cache_key)
                if cached_data:
                    return Customer(**json.loads(cached_data))

            # Query database with optimized join
            query = select(Customer).where(
                and_(
                    Customer.id == customer_id,
                    Customer.is_deleted == False
                )
            ).execution_options(populate_existing=True)

            result = self.db.execute(query).scalar_one_or_none()

            # Update cache if found
            if result and self.cache:
                await self.cache.set(
                    cache_key,
                    json.dumps(result.to_dict()),
                    expire=CACHE_TTL
                )

            return result

        except SQLAlchemyError as e:
            self.logger.error(f"Error retrieving customer {customer_id}: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to retrieve customer: {str(e)}",
                error_code="CUST001"
            )

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Dict = None
    ) -> List[Customer]:
        """
        Retrieve all customers with pagination and filtering.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            filters: Dictionary of filter conditions
            
        Returns:
            List[Customer]: Filtered and paginated customer list
        """
        try:
            # Build base query
            query = select(Customer).where(Customer.is_deleted == False)

            # Apply filters
            if filters:
                filter_conditions = []
                if filters.get("name"):
                    filter_conditions.append(
                        Customer.name.ilike(f"%{filters['name']}%")
                    )
                if filters.get("min_health_score"):
                    filter_conditions.append(
                        Customer.health_score >= filters["min_health_score"]
                    )
                if filters.get("max_risk_score"):
                    filter_conditions.append(
                        Customer.risk_score <= filters["max_risk_score"]
                    )
                if filter_conditions:
                    query = query.where(and_(*filter_conditions))

            # Apply pagination
            query = query.offset(skip).limit(limit)

            # Execute optimized query
            result = self.db.execute(query).scalars().all()
            return result

        except SQLAlchemyError as e:
            self.logger.error(f"Error retrieving customers: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to retrieve customers: {str(e)}",
                error_code="CUST002"
            )

    async def get_at_risk(
        self,
        risk_threshold: float = DEFAULT_RISK_THRESHOLD
    ) -> List[Customer]:
        """
        Retrieve high-risk customers with optimized query.
        
        Args:
            risk_threshold: Risk score threshold for filtering
            
        Returns:
            List[Customer]: List of at-risk customers
        """
        try:
            query = select(Customer).where(
                and_(
                    Customer.is_deleted == False,
                    Customer.risk_score >= risk_threshold
                )
            ).order_by(desc(Customer.risk_score))

            result = self.db.execute(query).scalars().all()
            return result

        except SQLAlchemyError as e:
            self.logger.error(f"Error retrieving at-risk customers: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to retrieve at-risk customers: {str(e)}",
                error_code="CUST003"
            )

    async def create(self, customer_data: Dict) -> Customer:
        """
        Create new customer with validation.
        
        Args:
            customer_data: Dictionary containing customer data
            
        Returns:
            Customer: Created customer instance
        """
        try:
            # Create customer instance
            customer = Customer(**customer_data)
            
            # Add to database
            self.db.add(customer)
            self.db.commit()
            self.db.refresh(customer)

            # Update cache
            if self.cache:
                cache_key = self._get_cache_key(customer.id)
                await self.cache.set(
                    cache_key,
                    json.dumps(customer.to_dict()),
                    expire=CACHE_TTL
                )

            return customer

        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error creating customer: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to create customer: {str(e)}",
                error_code="CUST004"
            )

    async def update(
        self,
        customer_id: UUID,
        update_data: Dict
    ) -> Optional[Customer]:
        """
        Update customer with optimistic locking.
        
        Args:
            customer_id: UUID of customer to update
            update_data: Dictionary containing update data
            
        Returns:
            Optional[Customer]: Updated customer if found
        """
        try:
            # Get customer with lock
            query = select(Customer).where(
                and_(
                    Customer.id == customer_id,
                    Customer.is_deleted == False
                )
            ).with_for_update()

            customer = self.db.execute(query).scalar_one_or_none()
            if not customer:
                return None

            # Apply updates
            for key, value in update_data.items():
                if hasattr(customer, key):
                    setattr(customer, key, value)

            # Commit changes
            self.db.commit()
            self.db.refresh(customer)

            # Invalidate cache
            if self.cache:
                cache_key = self._get_cache_key(customer_id)
                await self.cache.delete(cache_key)

            return customer

        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error updating customer {customer_id}: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to update customer: {str(e)}",
                error_code="CUST005"
            )

    async def delete(self, customer_id: UUID) -> bool:
        """
        Soft delete customer with cascade.
        
        Args:
            customer_id: UUID of customer to delete
            
        Returns:
            bool: True if deleted, False if not found
        """
        try:
            # Soft delete customer
            query = update(Customer).where(
                and_(
                    Customer.id == customer_id,
                    Customer.is_deleted == False
                )
            ).values(is_deleted=True)

            result = self.db.execute(query)
            self.db.commit()

            # Remove from cache
            if self.cache:
                cache_key = self._get_cache_key(customer_id)
                await self.cache.delete(cache_key)

            return result.rowcount > 0

        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error deleting customer {customer_id}: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to delete customer: {str(e)}",
                error_code="CUST006"
            )