"""
Service layer module implementing core customer management functionality for the Customer Success AI Platform.
Provides optimized customer lifecycle operations, health scoring, and risk assessment integration.

Dependencies:
- redis==4.5.0
- datadog==1.0.0
"""

import logging
from typing import Dict, List, Optional, Any
from uuid import UUID
import json
from datetime import datetime

from models.customer import Customer
from db.repositories.customers import CustomerRepository
from services.risk import RiskService
from core.exceptions import BaseCustomException

# Configure module logger
logger = logging.getLogger(__name__)

# Performance thresholds
HEALTH_SCORE_THRESHOLD_CRITICAL = 60.0
HEALTH_SCORE_THRESHOLD_WARNING = 75.0
CACHE_TTL_SECONDS = 300
MAX_RETRIES = 3

class CustomerService:
    """Enhanced service class implementing customer management with optimized performance and monitoring."""

    def __init__(
        self,
        repository: CustomerRepository,
        risk_service: RiskService,
        cache_client: Any,
        metrics_client: Any
    ) -> None:
        """
        Initialize customer service with enhanced dependencies.

        Args:
            repository: Data access layer for customer operations
            risk_service: Risk assessment service
            cache_client: Redis cache client
            metrics_client: Datadog metrics client
        """
        self._repository = repository
        self._risk_service = risk_service
        self._cache = cache_client
        self._metrics = metrics_client
        
        # Initialize performance tracking
        self._performance_metrics = {
            'operations': {'count': 0, 'errors': 0, 'latency': []},
            'cache': {'hits': 0, 'misses': 0},
            'health_scores': {'critical': 0, 'warning': 0, 'healthy': 0}
        }

    async def get_customer(self, customer_id: UUID) -> Optional[Customer]:
        """
        Retrieve customer by ID with caching and performance optimization.

        Args:
            customer_id: UUID of customer to retrieve

        Returns:
            Optional[Customer]: Customer if found, None otherwise

        Raises:
            BaseCustomException: On retrieval or validation errors
        """
        try:
            start_time = datetime.utcnow()

            # Check cache first
            cache_key = f"customer:{str(customer_id)}"
            cached_data = await self._cache.get(cache_key)
            
            if cached_data:
                self._performance_metrics['cache']['hits'] += 1
                customer = Customer(**json.loads(cached_data))
            else:
                self._performance_metrics['cache']['misses'] += 1
                customer = await self._repository.get_by_id(customer_id)
                
                if customer:
                    # Cache customer data
                    await self._cache.set(
                        cache_key,
                        json.dumps(customer.to_dict()),
                        expire=CACHE_TTL_SECONDS
                    )

            if customer:
                # Calculate current health score
                customer.calculate_health_score(force_refresh=True)
                
                # Get real-time risk profile
                risk_profile = await self._risk_service.get_risk_profile(customer_id)
                if risk_profile:
                    customer.risk_score = risk_profile.score

            # Track performance metrics
            operation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._update_metrics('get_customer', operation_time)

            return customer

        except Exception as e:
            self._performance_metrics['operations']['errors'] += 1
            logger.error(f"Error retrieving customer {customer_id}: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to retrieve customer: {str(e)}",
                error_code="CUST001"
            )

    async def create_customer(self, customer_data: Dict[str, Any]) -> Customer:
        """
        Create new customer with validation and monitoring.

        Args:
            customer_data: Dictionary containing customer data

        Returns:
            Customer: Created customer instance

        Raises:
            BaseCustomException: On creation or validation errors
        """
        try:
            start_time = datetime.utcnow()

            # Create customer
            customer = await self._repository.create(customer_data)

            # Initialize health score
            customer.calculate_health_score()

            # Create initial risk profile
            await self._risk_service.assess_customer_risk(
                customer.id,
                customer_data.get('risk_data', {})
            )

            # Cache new customer
            cache_key = f"customer:{str(customer.id)}"
            await self._cache.set(
                cache_key,
                json.dumps(customer.to_dict()),
                expire=CACHE_TTL_SECONDS
            )

            # Track performance
            operation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._update_metrics('create_customer', operation_time)

            return customer

        except Exception as e:
            self._performance_metrics['operations']['errors'] += 1
            logger.error(f"Error creating customer: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to create customer: {str(e)}",
                error_code="CUST002"
            )

    async def update_customer(
        self,
        customer_id: UUID,
        update_data: Dict[str, Any]
    ) -> Optional[Customer]:
        """
        Update customer with optimistic locking and cache invalidation.

        Args:
            customer_id: UUID of customer to update
            update_data: Dictionary containing update data

        Returns:
            Optional[Customer]: Updated customer if found

        Raises:
            BaseCustomException: On update or validation errors
        """
        try:
            start_time = datetime.utcnow()

            # Update customer
            customer = await self._repository.update(customer_id, update_data)
            
            if customer:
                # Recalculate health score
                customer.calculate_health_score(force_refresh=True)

                # Update risk assessment if needed
                if 'risk_data' in update_data:
                    await self._risk_service.update_risk_assessment(
                        customer_id,
                        update_data['risk_data']
                    )

                # Invalidate and update cache
                cache_key = f"customer:{str(customer_id)}"
                await self._cache.delete(cache_key)
                await self._cache.set(
                    cache_key,
                    json.dumps(customer.to_dict()),
                    expire=CACHE_TTL_SECONDS
                )

            # Track performance
            operation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._update_metrics('update_customer', operation_time)

            return customer

        except Exception as e:
            self._performance_metrics['operations']['errors'] += 1
            logger.error(f"Error updating customer {customer_id}: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to update customer: {str(e)}",
                error_code="CUST003"
            )

    async def delete_customer(self, customer_id: UUID) -> bool:
        """
        Soft delete customer with cascade and cache cleanup.

        Args:
            customer_id: UUID of customer to delete

        Returns:
            bool: True if deleted successfully

        Raises:
            BaseCustomException: On deletion errors
        """
        try:
            start_time = datetime.utcnow()

            # Delete customer
            success = await self._repository.delete(customer_id)

            if success:
                # Clear cache
                cache_key = f"customer:{str(customer_id)}"
                await self._cache.delete(cache_key)

            # Track performance
            operation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._update_metrics('delete_customer', operation_time)

            return success

        except Exception as e:
            self._performance_metrics['operations']['errors'] += 1
            logger.error(f"Error deleting customer {customer_id}: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to delete customer: {str(e)}",
                error_code="CUST004"
            )

    async def get_at_risk_customers(self) -> List[Customer]:
        """
        Retrieve customers with critical health scores.

        Returns:
            List[Customer]: List of at-risk customers

        Raises:
            BaseCustomException: On retrieval errors
        """
        try:
            start_time = datetime.utcnow()

            # Get customers below critical threshold
            customers = await self._repository.get_by_health_score(
                max_score=HEALTH_SCORE_THRESHOLD_CRITICAL
            )

            # Enrich with risk profiles
            for customer in customers:
                risk_profile = await self._risk_service.get_risk_profile(customer.id)
                if risk_profile:
                    customer.risk_score = risk_profile.score

            # Track performance
            operation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._update_metrics('get_at_risk_customers', operation_time)

            return customers

        except Exception as e:
            self._performance_metrics['operations']['errors'] += 1
            logger.error(f"Error retrieving at-risk customers: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to retrieve at-risk customers: {str(e)}",
                error_code="CUST005"
            )

    async def calculate_customer_health(self, customer_id: UUID) -> float:
        """
        Calculate comprehensive customer health score.

        Args:
            customer_id: UUID of customer

        Returns:
            float: Calculated health score

        Raises:
            BaseCustomException: On calculation errors
        """
        try:
            start_time = datetime.utcnow()

            # Get customer
            customer = await self.get_customer(customer_id)
            if not customer:
                raise ValueError("Customer not found")

            # Calculate health score
            health_score = customer.calculate_health_score(force_refresh=True)

            # Update health score metrics
            if health_score <= HEALTH_SCORE_THRESHOLD_CRITICAL:
                self._performance_metrics['health_scores']['critical'] += 1
            elif health_score <= HEALTH_SCORE_THRESHOLD_WARNING:
                self._performance_metrics['health_scores']['warning'] += 1
            else:
                self._performance_metrics['health_scores']['healthy'] += 1

            # Track performance
            operation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._update_metrics('calculate_health', operation_time)

            return health_score

        except Exception as e:
            self._performance_metrics['operations']['errors'] += 1
            logger.error(f"Error calculating health score for {customer_id}: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to calculate health score: {str(e)}",
                error_code="CUST006"
            )

    def _update_metrics(self, operation: str, latency: float) -> None:
        """Update service performance metrics."""
        self._performance_metrics['operations']['count'] += 1
        self._performance_metrics['operations']['latency'].append(latency)

        # Keep only last 1000 latency measurements
        if len(self._performance_metrics['operations']['latency']) > 1000:
            self._performance_metrics['operations']['latency'] = \
                self._performance_metrics['operations']['latency'][-1000:]

        # Send metrics to Datadog
        self._metrics.gauge(
            'customer_service.operation_latency',
            latency,
            tags=[f'operation:{operation}']
        )
        self._metrics.increment(
            'customer_service.operations',
            tags=[f'operation:{operation}']
        )