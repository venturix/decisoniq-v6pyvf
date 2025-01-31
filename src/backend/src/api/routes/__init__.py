"""
API routes initialization module for Customer Success AI Platform.
Aggregates and exports route modules with comprehensive security, monitoring,
and caching configuration.

Version: FastAPI 0.100+
Dependencies:
- fastapi==0.100+
- prometheus-client==0.17+
- redis==4.5+
"""

import logging
from typing import List
from fastapi import APIRouter, FastAPI
from prometheus_client import Counter, Histogram

from .auth import router as auth_router
from .customers import router as customers_router
from .health import router as health_router
from .playbooks import router as playbooks_router
from .risk import router as risk_router
from .metrics import router as metrics_router
from .ml import router as ml_router
from .integrations import router as integrations_router

from core.cache import CacheManager
from core.monitoring import monitor_performance
from core.security import SecurityMiddleware

# Configure module logger
logger = logging.getLogger(__name__)

# Initialize metrics
ROUTER_METRICS = {
    'requests': Counter(
        'api_requests_total',
        'Total API requests',
        ['router', 'method']
    ),
    'errors': Counter(
        'api_errors_total',
        'Total API errors',
        ['router', 'error_type']
    ),
    'latency': Histogram(
        'api_request_duration_seconds',
        'API request duration',
        ['router']
    )
}

# Route-specific rate limits (requests per hour)
RATE_LIMITS = {
    'auth': 1000,
    'customers': 1000,
    'health': 100,
    'playbooks': 200,
    'risk': 500,
    'metrics': 100,
    'ml': 100,
    'integrations': 500
}

# Route-specific cache TTLs (seconds)
CACHE_TTLS = {
    'customers': 300,  # 5 minutes
    'health': 60,      # 1 minute
    'risk': 300,       # 5 minutes
    'metrics': 300,    # 5 minutes
    'ml': 300         # 5 minutes
}

def get_routers() -> List[APIRouter]:
    """
    Returns configured list of all route modules with security, caching,
    and monitoring.

    Returns:
        List[APIRouter]: List of configured FastAPI router instances
    """
    try:
        # Initialize cache manager
        cache_manager = CacheManager()

        # Configure all routers with monitoring and security
        routers = [
            configure_route(auth_router, "auth"),
            configure_route(customers_router, "customers"),
            configure_route(health_router, "health"),
            configure_route(playbooks_router, "playbooks"),
            configure_route(risk_router, "risk"),
            configure_route(metrics_router, "metrics"),
            configure_route(ml_router, "ml"),
            configure_route(integrations_router, "integrations")
        ]

        logger.info("API routes initialized successfully")
        return routers

    except Exception as e:
        logger.error(f"Failed to initialize API routes: {str(e)}")
        raise

def configure_route(router: APIRouter, route_name: str) -> APIRouter:
    """
    Configures individual route with security, caching and monitoring.

    Args:
        router: FastAPI router instance
        route_name: Name of the route for configuration

    Returns:
        APIRouter: Configured router instance
    """
    try:
        # Add rate limiting
        if route_name in RATE_LIMITS:
            router.dependencies.append(
                SecurityMiddleware.rate_limit(
                    limit=RATE_LIMITS[route_name],
                    period=3600  # 1 hour
                )
            )

        # Add caching if configured
        if route_name in CACHE_TTLS:
            router.dependencies.append(
                SecurityMiddleware.cache_response(
                    ttl=CACHE_TTLS[route_name]
                )
            )

        # Add performance monitoring
        router.dependencies.append(monitor_performance)

        # Add security middleware
        router.dependencies.append(
            SecurityMiddleware.validate_token
        )

        # Add audit logging
        router.dependencies.append(
            SecurityMiddleware.audit_log
        )

        # Configure metrics tracking
        @router.middleware("http")
        async def track_metrics(request, call_next):
            ROUTER_METRICS['requests'].labels(
                router=route_name,
                method=request.method
            ).inc()
            
            try:
                response = await call_next(request)
                return response
            except Exception as e:
                ROUTER_METRICS['errors'].labels(
                    router=route_name,
                    error_type=type(e).__name__
                ).inc()
                raise

        logger.info(f"Configured route: {route_name}")
        return router

    except Exception as e:
        logger.error(f"Failed to configure route {route_name}: {str(e)}")
        raise

# Export configured routers
__all__ = ['get_routers']