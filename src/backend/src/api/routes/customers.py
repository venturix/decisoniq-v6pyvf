"""
FastAPI router module implementing RESTful API endpoints for customer management
in the Customer Success AI Platform with enhanced security, caching, and monitoring.

Version: FastAPI 0.100+
"""

import logging
import time
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import JSONResponse
import structlog
from prometheus_client import Counter, Histogram

from services.customer import CustomerService
from schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from api.dependencies import get_current_user, get_db_session, PermissionChecker
from core.cache import CacheManager
from core.exceptions import BaseCustomException

# Initialize router with prefix and tags
router = APIRouter(prefix='/api/v1/customers', tags=['customers'])

# Configure structured logging
logger = structlog.get_logger(__name__)

# Initialize metrics
CUSTOMER_REQUESTS = Counter(
    'customer_api_requests_total',
    'Total customer API requests',
    ['endpoint', 'method']
)
REQUEST_LATENCY = Histogram(
    'customer_api_request_duration_seconds',
    'Customer API request duration',
    ['endpoint']
)

# Initialize cache manager
cache = CacheManager()

@router.get(
    '/',
    response_model=List[CustomerResponse],
    summary="Retrieve paginated customer list",
    description="Get paginated list of customers with optional filtering and caching"
)
async def get_customers(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    health_score_threshold: Optional[float] = Query(
        None, ge=0, le=100,
        description="Filter by minimum health score"
    ),
    at_risk_only: Optional[bool] = Query(
        False,
        description="Filter for at-risk customers only"
    ),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db_session),
    permission: bool = Depends(PermissionChecker(['customers:read']))
):
    """
    Retrieve paginated list of customers with filtering and caching.
    """
    try:
        start_time = time.time()
        CUSTOMER_REQUESTS.labels(endpoint='/customers', method='GET').inc()

        # Initialize service
        customer_service = CustomerService(db)

        # Check cache
        cache_key = f"customers:list:p{page}:l{limit}:h{health_score_threshold}:r{at_risk_only}"
        cached_response = await cache.get(cache_key)
        if cached_response:
            return JSONResponse(content=cached_response)

        # Get customers based on filters
        if at_risk_only:
            customers = await customer_service.get_at_risk_customers()
        else:
            customers = await customer_service.get_customers(
                skip=(page - 1) * limit,
                limit=limit,
                health_score_threshold=health_score_threshold
            )

        # Convert to response models
        response = [CustomerResponse.from_orm(c) for c in customers]

        # Cache response
        await cache.set(
            cache_key,
            [c.dict() for c in response],
            'customer_list',
            {'ttl': 300}  # 5 minute cache
        )

        # Record metrics
        REQUEST_LATENCY.labels(endpoint='/customers').observe(time.time() - start_time)

        return response

    except Exception as e:
        logger.error("Failed to retrieve customers", error=str(e))
        raise BaseCustomException(
            message="Failed to retrieve customers",
            error_code="CUST001",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@router.get(
    '/{customer_id}',
    response_model=CustomerResponse,
    summary="Get customer by ID",
    description="Retrieve detailed customer information by ID with caching"
)
async def get_customer_by_id(
    customer_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db_session),
    permission: bool = Depends(PermissionChecker(['customers:read']))
):
    """
    Retrieve customer by ID with caching and monitoring.
    """
    try:
        start_time = time.time()
        CUSTOMER_REQUESTS.labels(endpoint='/customers/{id}', method='GET').inc()

        # Check cache
        cache_key = f"customer:{customer_id}"
        cached_response = await cache.get(cache_key)
        if cached_response:
            return JSONResponse(content=cached_response)

        # Get customer
        customer_service = CustomerService(db)
        customer = await customer_service.get_customer(customer_id)

        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        # Convert to response model
        response = CustomerResponse.from_orm(customer)

        # Cache response
        await cache.set(
            cache_key,
            response.dict(),
            'customer_detail',
            {'ttl': 300}  # 5 minute cache
        )

        # Record metrics
        REQUEST_LATENCY.labels(endpoint='/customers/{id}').observe(time.time() - start_time)

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to retrieve customer", error=str(e), customer_id=str(customer_id))
        raise BaseCustomException(
            message="Failed to retrieve customer",
            error_code="CUST002",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@router.post(
    '/',
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new customer",
    description="Create new customer with validation and monitoring"
)
async def create_customer(
    customer: CustomerCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db_session),
    permission: bool = Depends(PermissionChecker(['customers:create']))
):
    """
    Create new customer with validation and monitoring.
    """
    try:
        start_time = time.time()
        CUSTOMER_REQUESTS.labels(endpoint='/customers', method='POST').inc()

        # Create customer
        customer_service = CustomerService(db)
        new_customer = await customer_service.create_customer(customer.dict())

        # Convert to response model
        response = CustomerResponse.from_orm(new_customer)

        # Record metrics
        REQUEST_LATENCY.labels(endpoint='/customers').observe(time.time() - start_time)

        return response

    except Exception as e:
        logger.error("Failed to create customer", error=str(e))
        raise BaseCustomException(
            message="Failed to create customer",
            error_code="CUST003",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@router.put(
    '/{customer_id}',
    response_model=CustomerResponse,
    summary="Update customer",
    description="Update customer information with validation and caching"
)
async def update_customer(
    customer_id: UUID,
    customer: CustomerUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db_session),
    permission: bool = Depends(PermissionChecker(['customers:update']))
):
    """
    Update customer with validation and cache invalidation.
    """
    try:
        start_time = time.time()
        CUSTOMER_REQUESTS.labels(endpoint='/customers/{id}', method='PUT').inc()

        # Update customer
        customer_service = CustomerService(db)
        updated_customer = await customer_service.update_customer(
            customer_id,
            customer.dict(exclude_unset=True)
        )

        if not updated_customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        # Convert to response model
        response = CustomerResponse.from_orm(updated_customer)

        # Invalidate cache
        await cache.delete(f"customer:{customer_id}")
        await cache.delete("customers:list*")

        # Record metrics
        REQUEST_LATENCY.labels(endpoint='/customers/{id}').observe(time.time() - start_time)

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update customer", error=str(e), customer_id=str(customer_id))
        raise BaseCustomException(
            message="Failed to update customer",
            error_code="CUST004",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@router.delete(
    '/{customer_id}',
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete customer",
    description="Soft delete customer with cache invalidation"
)
async def delete_customer(
    customer_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db_session),
    permission: bool = Depends(PermissionChecker(['customers:delete']))
):
    """
    Soft delete customer with cache invalidation.
    """
    try:
        start_time = time.time()
        CUSTOMER_REQUESTS.labels(endpoint='/customers/{id}', method='DELETE').inc()

        # Delete customer
        customer_service = CustomerService(db)
        success = await customer_service.delete_customer(customer_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        # Invalidate cache
        await cache.delete(f"customer:{customer_id}")
        await cache.delete("customers:list*")

        # Record metrics
        REQUEST_LATENCY.labels(endpoint='/customers/{id}').observe(time.time() - start_time)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete customer", error=str(e), customer_id=str(customer_id))
        raise BaseCustomException(
            message="Failed to delete customer",
            error_code="CUST005",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@router.get(
    '/{customer_id}/health',
    response_model=float,
    summary="Get customer health score",
    description="Calculate customer health score with caching"
)
async def get_customer_health(
    customer_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db_session),
    permission: bool = Depends(PermissionChecker(['customers:read']))
):
    """
    Calculate customer health score with caching.
    """
    try:
        start_time = time.time()
        CUSTOMER_REQUESTS.labels(endpoint='/customers/{id}/health', method='GET').inc()

        # Check cache
        cache_key = f"customer:health:{customer_id}"
        cached_score = await cache.get(cache_key)
        if cached_score is not None:
            return float(cached_score)

        # Calculate health score
        customer_service = CustomerService(db)
        health_score = await customer_service.calculate_customer_health(customer_id)

        # Cache score
        await cache.set(
            cache_key,
            str(health_score),
            'health_score',
            {'ttl': 300}  # 5 minute cache
        )

        # Record metrics
        REQUEST_LATENCY.labels(endpoint='/customers/{id}/health').observe(time.time() - start_time)

        return health_score

    except Exception as e:
        logger.error("Failed to get health score", error=str(e), customer_id=str(customer_id))
        raise BaseCustomException(
            message="Failed to calculate health score",
            error_code="CUST006",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )