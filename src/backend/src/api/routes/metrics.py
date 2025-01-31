"""
FastAPI router module implementing API endpoints for customer success metrics,
performance analytics, and reporting with enhanced security and caching.

Version: FastAPI 0.100+
Dependencies:
- fastapi==0.100.0
- redis==4.5.0
- prometheus-client==0.16.0
"""

import logging
from typing import Dict, List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from prometheus_client import Counter, Histogram

from schemas.metrics import CustomerMetricSchema
from services.metrics import MetricsService
from core.cache import CacheManager
from core.logging import AuditLogger
from core.security import get_current_user, PermissionChecker
from core.monitoring import monitor_performance, track_execution_time

# Configure router with prefix and tags
router = APIRouter(prefix='/api/v1/metrics', tags=['metrics'])

# Initialize logging
logger = logging.getLogger(__name__)

# Configure monitoring metrics
METRIC_COUNTER = Counter('metric_requests_total', 'Total metric endpoint requests')
METRIC_LATENCY = Histogram('metric_request_duration_seconds', 'Metric request duration')

# Cache configuration
CACHE_TTL = 300  # 5 minutes

@router.get('/{customer_id}/health', response_model=CustomerMetricSchema)
@monitor_performance
async def get_customer_health(
    customer_id: UUID,
    request: Request,
    current_user = Depends(get_current_user),
    permissions = Depends(PermissionChecker(['view_metrics'])),
    cache: CacheManager = Depends(CacheManager),
    metrics_service: MetricsService = Depends(MetricsService)
) -> Dict:
    """
    Retrieve customer health score with caching and monitoring.
    
    Args:
        customer_id: UUID of customer
        request: FastAPI request object
        current_user: Authenticated user
        permissions: Permission checker
        cache: Cache manager instance
        metrics_service: Metrics service instance
        
    Returns:
        Dict containing health score and analysis
    """
    try:
        # Increment request counter
        METRIC_COUNTER.inc()
        
        # Check cache first
        cache_key = f"health:{customer_id}"
        cached_result = await cache.get(cache_key)
        if cached_result:
            return cached_result

        # Calculate health score
        with track_execution_time(METRIC_LATENCY):
            health_score = await metrics_service.calculate_customer_health(customer_id)

        # Log metric access
        AuditLogger.log_metric_access(
            user_id=current_user.id,
            customer_id=customer_id,
            metric_type="health_score"
        )

        # Cache result
        await cache.set(
            cache_key,
            health_score,
            cache_type="customer_health",
            metadata={"customer_id": str(customer_id)}
        )

        return health_score

    except Exception as e:
        logger.error(f"Error getting customer health: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/aggregate')
@monitor_performance
async def get_aggregated_metrics(
    metric_type: str = Query(..., description="Type of metric to aggregate"),
    period: str = Query(..., description="Aggregation period"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user = Depends(get_current_user),
    permissions = Depends(PermissionChecker(['view_metrics'])),
    metrics_service: MetricsService = Depends(MetricsService)
) -> Dict:
    """
    Retrieve aggregated metrics with filtering and analysis.
    
    Args:
        metric_type: Type of metric to aggregate
        period: Aggregation period (daily, weekly, monthly)
        start_date: Optional start date for filtering
        end_date: Optional end date for filtering
        current_user: Authenticated user
        permissions: Permission checker
        metrics_service: Metrics service instance
        
    Returns:
        Dict containing aggregated metrics and analysis
    """
    try:
        # Increment request counter
        METRIC_COUNTER.inc()

        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Get aggregated metrics
        with track_execution_time(METRIC_LATENCY):
            aggregated_metrics = await metrics_service.aggregate_metrics(
                metric_type=metric_type,
                aggregation_period=period,
                start_date=start_date,
                end_date=end_date
            )

        # Log metric access
        AuditLogger.log_metric_access(
            user_id=current_user.id,
            metric_type=f"aggregate_{metric_type}",
            period=period
        )

        return aggregated_metrics

    except Exception as e:
        logger.error(f"Error getting aggregated metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/revenue-impact')
@monitor_performance
async def get_revenue_impact(
    customer_ids: List[UUID] = Query(...),
    current_user = Depends(get_current_user),
    permissions = Depends(PermissionChecker(['view_revenue_metrics'])),
    metrics_service: MetricsService = Depends(MetricsService)
) -> Dict:
    """
    Calculate revenue impact analysis for specified customers.
    
    Args:
        customer_ids: List of customer UUIDs to analyze
        current_user: Authenticated user
        permissions: Permission checker
        metrics_service: Metrics service instance
        
    Returns:
        Dict containing revenue impact analysis
    """
    try:
        # Increment request counter
        METRIC_COUNTER.inc()

        # Calculate revenue impact
        with track_execution_time(METRIC_LATENCY):
            impact_analysis = await metrics_service.calculate_revenue_impact(customer_ids)

        # Log metric access
        AuditLogger.log_metric_access(
            user_id=current_user.id,
            metric_type="revenue_impact",
            customer_count=len(customer_ids)
        )

        return impact_analysis

    except Exception as e:
        logger.error(f"Error calculating revenue impact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/performance-report')
@monitor_performance
async def get_performance_report(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    current_user = Depends(get_current_user),
    permissions = Depends(PermissionChecker(['view_reports'])),
    metrics_service: MetricsService = Depends(MetricsService)
) -> Dict:
    """
    Generate comprehensive performance metrics report.
    
    Args:
        start_date: Report period start date
        end_date: Report period end date
        current_user: Authenticated user
        permissions: Permission checker
        metrics_service: Metrics service instance
        
    Returns:
        Dict containing performance report and insights
    """
    try:
        # Increment request counter
        METRIC_COUNTER.inc()

        # Generate performance report
        with track_execution_time(METRIC_LATENCY):
            report = await metrics_service.generate_performance_report(
                start_date=start_date,
                end_date=end_date
            )

        # Log report generation
        AuditLogger.log_metric_access(
            user_id=current_user.id,
            metric_type="performance_report",
            period=f"{start_date.isoformat()} to {end_date.isoformat()}"
        )

        return report

    except Exception as e:
        logger.error(f"Error generating performance report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))