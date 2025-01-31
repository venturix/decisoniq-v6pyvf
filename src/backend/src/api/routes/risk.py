"""
FastAPI router module for risk assessment and management endpoints.
Provides optimized API routes with caching, monitoring, and audit logging.

Dependencies:
- fastapi==0.100.0
- prometheus-client==0.17.0
"""

import logging
import time
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from prometheus_client import Counter, Histogram

from services.risk import RiskService
from core.cache import RiskProfileCache
from core.logging import AuditLogger
from core.exceptions import PredictionServiceError
from schemas.risk import RiskProfileCreate, RiskProfileResponse
from db.session import get_db
from auth.dependencies import get_current_user, PermissionChecker

# Configure module logger
logger = logging.getLogger(__name__)

# Initialize router with prefix and tags
router = APIRouter(prefix="/api/v1/risk", tags=["risk"])

# Initialize dependencies
cache = RiskProfileCache()
audit = AuditLogger()

# Prometheus metrics
RISK_REQUESTS = Counter(
    "risk_requests_total",
    "Total number of risk assessment requests",
    ["endpoint", "status"]
)

RISK_LATENCY = Histogram(
    "risk_request_latency_seconds",
    "Risk assessment request latency",
    ["endpoint"],
    buckets=[0.1, 0.5, 1.0, 2.0, 3.0, 5.0]
)

@router.get("/{customer_id}", response_model=RiskProfileResponse)
async def get_risk_profile(
    customer_id: UUID,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(PermissionChecker(["view_risk_profiles"]))
) -> RiskProfileResponse:
    """
    Retrieve risk profile for a specific customer with caching and monitoring.

    Args:
        customer_id: UUID of customer
        db: Database session
        current_user: Authenticated user
        _: Permission checker

    Returns:
        RiskProfileResponse: Customer risk profile
    """
    start_time = time.time()
    try:
        # Check cache first
        cached_profile = await cache.get_profile(str(customer_id))
        if cached_profile:
            RISK_REQUESTS.labels(endpoint="get_profile", status="cache_hit").inc()
            return RiskProfileResponse(**cached_profile)

        # Get from service if not cached
        risk_service = RiskService(db)
        profile = await risk_service.get_customer_risk_profile(customer_id)

        if not profile:
            RISK_REQUESTS.labels(endpoint="get_profile", status="not_found").inc()
            raise HTTPException(status_code=404, detail="Risk profile not found")

        # Update cache
        await cache.set_profile(str(customer_id), profile.dict())

        # Log audit trail
        await audit.log_risk_access(
            action="view_profile",
            customer_id=customer_id,
            user_id=current_user.id
        )

        RISK_REQUESTS.labels(endpoint="get_profile", status="success").inc()
        RISK_LATENCY.labels(endpoint="get_profile").observe(time.time() - start_time)

        return profile

    except Exception as e:
        RISK_REQUESTS.labels(endpoint="get_profile", status="error").inc()
        logger.error(f"Error retrieving risk profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/assess/{customer_id}", response_model=RiskProfileResponse)
async def assess_risk(
    customer_id: UUID,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(PermissionChecker(["perform_risk_assessment"]))
) -> RiskProfileResponse:
    """
    Perform risk assessment for a customer with performance monitoring.

    Args:
        customer_id: UUID of customer
        db: Database session
        current_user: Authenticated user
        _: Permission checker

    Returns:
        RiskProfileResponse: Risk assessment results
    """
    start_time = time.time()
    try:
        risk_service = RiskService(db)
        assessment = await risk_service.assess_customer_risk(customer_id)

        # Update cache with new assessment
        await cache.set_profile(str(customer_id), assessment.dict())

        # Log audit trail
        await audit.log_risk_access(
            action="perform_assessment",
            customer_id=customer_id,
            user_id=current_user.id,
            assessment_id=assessment.id
        )

        RISK_REQUESTS.labels(endpoint="assess", status="success").inc()
        RISK_LATENCY.labels(endpoint="assess").observe(time.time() - start_time)

        return assessment

    except PredictionServiceError as e:
        RISK_REQUESTS.labels(endpoint="assess", status="prediction_error").inc()
        logger.error(f"Prediction service error: {str(e)}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        RISK_REQUESTS.labels(endpoint="assess", status="error").inc()
        logger.error(f"Error performing risk assessment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{customer_id}", response_model=RiskProfileResponse)
async def update_risk_profile(
    customer_id: UUID,
    profile_data: RiskProfileCreate,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(PermissionChecker(["update_risk_profiles"]))
) -> RiskProfileResponse:
    """
    Update risk profile with audit logging and cache invalidation.

    Args:
        customer_id: UUID of customer
        profile_data: Updated profile data
        db: Database session
        current_user: Authenticated user
        _: Permission checker

    Returns:
        RiskProfileResponse: Updated risk profile
    """
    start_time = time.time()
    try:
        risk_service = RiskService(db)
        updated_profile = await risk_service.update_risk_assessment(
            customer_id,
            profile_data.dict()
        )

        # Invalidate and update cache
        await cache.delete(str(customer_id))
        await cache.set_profile(str(customer_id), updated_profile.dict())

        # Log audit trail
        await audit.log_risk_access(
            action="update_profile",
            customer_id=customer_id,
            user_id=current_user.id,
            changes=profile_data.dict()
        )

        RISK_REQUESTS.labels(endpoint="update", status="success").inc()
        RISK_LATENCY.labels(endpoint="update").observe(time.time() - start_time)

        return updated_profile

    except Exception as e:
        RISK_REQUESTS.labels(endpoint="update", status="error").inc()
        logger.error(f"Error updating risk profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/high-risk", response_model=List[RiskProfileResponse])
async def get_high_risk_customers(
    threshold: Optional[float] = Query(75.0, ge=0.0, le=100.0),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(PermissionChecker(["view_risk_profiles"]))
) -> List[RiskProfileResponse]:
    """
    Retrieve high-risk customer profiles with caching and pagination.

    Args:
        threshold: Risk score threshold (default: 75.0)
        db: Database session
        current_user: Authenticated user
        _: Permission checker

    Returns:
        List[RiskProfileResponse]: List of high-risk customer profiles
    """
    start_time = time.time()
    try:
        risk_service = RiskService(db)
        profiles = await risk_service.identify_high_risk_customers(threshold)

        # Cache individual profiles
        for profile in profiles:
            await cache.set_profile(str(profile.customer_id), profile.dict())

        # Log audit trail
        await audit.log_risk_access(
            action="view_high_risk",
            user_id=current_user.id,
            threshold=threshold,
            count=len(profiles)
        )

        RISK_REQUESTS.labels(endpoint="high_risk", status="success").inc()
        RISK_LATENCY.labels(endpoint="high_risk").observe(time.time() - start_time)

        return profiles

    except Exception as e:
        RISK_REQUESTS.labels(endpoint="high_risk", status="error").inc()
        logger.error(f"Error retrieving high-risk customers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))