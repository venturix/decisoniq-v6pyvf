"""
Enterprise-grade health check route handler for Customer Success AI Platform.
Provides comprehensive system health monitoring with caching and security controls.

Version: 1.0.0
Dependencies:
- fastapi==0.100.0
- fastapi-limiter==0.1.5
"""

import logging
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi_limiter import RateLimiter

from api.dependencies import get_db_session, get_redis_client
from core.telemetry import track_metric, MetricsTracker
from core.cache import HealthCheckCache

# Configure module logger
logger = logging.getLogger(__name__)

# Initialize router with prefix and tags
router = APIRouter(prefix='/health', tags=['Health'])

# Configure rate limiting and caching
RATE_LIMIT = "100/minute"  # Rate limit for health endpoints
CACHE_TTL = 60  # Cache health status for 60 seconds

@track_metric('database_health')
async def check_database(session=Depends(get_db_session)) -> Dict[str, Any]:
    """
    Comprehensive database health check with connection pool metrics.
    
    Args:
        session: Database session from dependency injection
        
    Returns:
        Dict containing detailed database health metrics
    """
    try:
        with MetricsTracker('db_health_check') as tracker:
            # Test primary database connection
            session.execute("SELECT 1")
            
            # Get connection pool metrics
            pool_info = {
                "pool_size": session.bind.pool.size(),
                "checkedin": session.bind.pool.checkedin(),
                "checkedout": session.bind.pool.checkedout(),
                "overflow": session.bind.pool.overflow()
            }
            
            # Check replication lag if applicable
            replication_lag = None
            try:
                result = session.execute(
                    "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))"
                )
                replication_lag = float(result.scalar() or 0)
            except Exception:
                pass

            return {
                "status": "healthy",
                "connection_active": True,
                "pool_metrics": pool_info,
                "replication_lag_seconds": replication_lag,
                "timestamp": datetime.utcnow().isoformat()
            }

    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "connection_active": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@track_metric('redis_health')
async def check_redis(redis_client=Depends(get_redis_client)) -> Dict[str, Any]:
    """
    Detailed Redis health check including cluster status and performance metrics.
    
    Args:
        redis_client: Redis client from dependency injection
        
    Returns:
        Dict containing detailed Redis health metrics
    """
    try:
        with MetricsTracker('redis_health_check') as tracker:
            # Test Redis connection
            await redis_client.ping()
            
            # Get Redis info
            info = await redis_client.info()
            
            # Get memory usage
            memory_info = {
                "used_memory": info.get("used_memory_human"),
                "peak_memory": info.get("used_memory_peak_human"),
                "fragmentation_ratio": info.get("mem_fragmentation_ratio")
            }
            
            # Get key space metrics
            keyspace_info = {
                "total_keys": sum(db.get("keys", 0) for db in info.get("keyspace", {}).values()),
                "expires": sum(db.get("expires", 0) for db in info.get("keyspace", {}).values())
            }

            return {
                "status": "healthy",
                "connection_active": True,
                "memory_metrics": memory_info,
                "keyspace_metrics": keyspace_info,
                "version": info.get("redis_version"),
                "timestamp": datetime.utcnow().isoformat()
            }

    except Exception as e:
        logger.error(f"Redis health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "connection_active": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@router.get('/', status_code=status.HTTP_200_OK)
@RateLimiter(RATE_LIMIT)
@track_metric('system_health')
async def get_health(
    db_health: Dict = Depends(check_database),
    redis_health: Dict = Depends(check_redis)
) -> Dict[str, Any]:
    """
    Enterprise-grade health check endpoint with comprehensive system status.
    Implements caching and rate limiting for optimal performance.
    
    Args:
        db_health: Database health metrics from dependency
        redis_health: Redis health metrics from dependency
        
    Returns:
        Dict containing comprehensive system health status
        
    Raises:
        HTTPException: If system is in critical state
    """
    try:
        with MetricsTracker('health_check', track_sla=True) as tracker:
            # Check cache for recent health status
            cache_key = "system_health"
            cached_status = await HealthCheckCache.get_cached_status(cache_key)
            
            if cached_status:
                return cached_status

            # Aggregate component health statuses
            components_status = {
                "database": db_health,
                "redis": redis_health
            }
            
            # Calculate overall system status
            is_healthy = all(
                component.get("status") == "healthy" 
                for component in components_status.values()
            )
            
            # Get system uptime and performance metrics
            system_metrics = {
                "uptime_seconds": float(open('/proc/uptime').read().split()[0]),
                "load_average": [float(x) for x in open('/proc/loadavg').read().split()[:3]],
                "memory_usage": dict(line.split(None, 1) for line in open('/proc/meminfo').readlines())
            }
            
            # Compile comprehensive health response
            health_status = {
                "status": "healthy" if is_healthy else "degraded",
                "timestamp": datetime.utcnow().isoformat(),
                "components": components_status,
                "system_metrics": system_metrics,
                "api_version": "v1",
                "environment": "production"
            }
            
            # Cache health status
            await HealthCheckCache.update_cache(cache_key, health_status, CACHE_TTL)
            
            # Track metrics
            track_metric(
                'health_check_status',
                1 if is_healthy else 0,
                {"status": health_status["status"]}
            )
            
            # Raise error if system is unhealthy
            if not is_healthy:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="System is in degraded state"
                )
            
            return health_status

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check error: {str(e)}"
        )