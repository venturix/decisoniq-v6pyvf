"""
Redis cache implementation module for Customer Success AI Platform.
Provides caching functionality with support for cluster mode, SSL, and configurable TTLs.
Implements the Cache-Aside pattern with comprehensive monitoring and error handling.

Dependencies:
- redis==4.x
"""

import json
import asyncio
from typing import Any, Dict, Optional
import redis
from redis.cluster import RedisCluster
from redis.connection import ConnectionPool
from redis.exceptions import RedisError, ConnectionError, TimeoutError

from ..config.cache import CacheSettings
from .exceptions import BaseCustomException

# Global cache key prefix to namespace all keys
CACHE_KEY_PREFIX: str = 'csai'

class CacheError(BaseCustomException):
    """Enhanced custom exception class for cache-related errors with monitoring integration."""
    
    def __init__(self, message: str, error_code: str, metadata: Optional[Dict] = None) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=503,
            metadata=metadata or {}
        )
        self.error_code = error_code
        self.metadata = metadata or {}

class CacheManager:
    """Advanced Redis cache manager with cluster support, connection pooling, and monitoring."""

    def __init__(self, settings: CacheSettings, pool_settings: Optional[Dict] = None) -> None:
        """Initialize Redis cache manager with enhanced features.
        
        Args:
            settings: Cache configuration settings
            pool_settings: Optional connection pool configuration
        """
        self._settings = settings
        self._stats = {
            'hits': 0,
            'misses': 0,
            'errors': 0,
            'latency_ms': []
        }
        
        # Configure connection pool
        pool_config = {
            'max_connections': pool_settings.get('max_connections', 50),
            'socket_timeout': pool_settings.get('socket_timeout', 5),
            'socket_connect_timeout': pool_settings.get('socket_connect_timeout', 2),
            'retry_on_timeout': True,
            'health_check_interval': 30
        }
        
        try:
            if settings.cluster_mode:
                self._pool = ConnectionPool.from_url(
                    settings.get_connection_url(),
                    **pool_config
                )
                self._client = RedisCluster(
                    connection_pool=self._pool,
                    decode_responses=True
                )
            else:
                self._pool = ConnectionPool.from_url(
                    settings.get_connection_url(),
                    **pool_config
                )
                self._client = redis.Redis(
                    connection_pool=self._pool,
                    decode_responses=True
                )
            
            # Verify connection
            self._client.ping()
            
        except (ConnectionError, TimeoutError) as e:
            raise CacheError(
                message=f"Failed to initialize Redis connection: {str(e)}",
                error_code="CACHE001",
                metadata={"connection_url": settings.get_connection_url()}
            )

    async def get(self, key: str, track_stats: bool = True) -> Any:
        """Retrieve value from cache with monitoring.
        
        Args:
            key: Cache key
            track_stats: Whether to track cache statistics
            
        Returns:
            Cached value or None if not found
        """
        cache_key = f"{CACHE_KEY_PREFIX}:{key}"
        
        try:
            start_time = asyncio.get_event_loop().time()
            value = await self._client.get(cache_key)
            
            if track_stats:
                latency = (asyncio.get_event_loop().time() - start_time) * 1000
                self._stats['latency_ms'].append(latency)
                if value:
                    self._stats['hits'] += 1
                else:
                    self._stats['misses'] += 1
            
            return json.loads(value) if value else None
            
        except RedisError as e:
            self._stats['errors'] += 1
            raise CacheError(
                message=f"Cache read error: {str(e)}",
                error_code="CACHE002",
                metadata={"key": cache_key}
            )

    async def set(
        self,
        key: str,
        value: Any,
        cache_type: str,
        metadata: Optional[Dict] = None
    ) -> bool:
        """Store value in cache with advanced TTL management.
        
        Args:
            key: Cache key
            value: Value to cache
            cache_type: Type of cached data for TTL determination
            metadata: Optional context for TTL adjustment
            
        Returns:
            Success status
        """
        cache_key = f"{CACHE_KEY_PREFIX}:{key}"
        
        try:
            # Serialize value
            serialized_value = json.dumps(value)
            
            # Get dynamic TTL based on cache type and context
            ttl = self._settings.get_ttl(cache_type, metadata)
            
            # Implement cache stampede prevention with small random jitter
            ttl = int(ttl * (1 + (asyncio.get_event_loop().time() % 0.1)))
            
            success = await self._client.setex(
                cache_key,
                ttl,
                serialized_value
            )
            
            return bool(success)
            
        except RedisError as e:
            self._stats['errors'] += 1
            raise CacheError(
                message=f"Cache write error: {str(e)}",
                error_code="CACHE003",
                metadata={"key": cache_key, "ttl": ttl}
            )

    async def delete(self, key: str) -> bool:
        """Delete value from cache.
        
        Args:
            key: Cache key to delete
            
        Returns:
            Success status
        """
        cache_key = f"{CACHE_KEY_PREFIX}:{key}"
        
        try:
            return bool(await self._client.delete(cache_key))
        except RedisError as e:
            self._stats['errors'] += 1
            raise CacheError(
                message=f"Cache delete error: {str(e)}",
                error_code="CACHE004",
                metadata={"key": cache_key}
            )

    async def clear(self, pattern: str = "*") -> bool:
        """Clear cache entries matching pattern.
        
        Args:
            pattern: Key pattern to match for deletion
            
        Returns:
            Success status
        """
        try:
            cache_pattern = f"{CACHE_KEY_PREFIX}:{pattern}"
            keys = await self._client.keys(cache_pattern)
            
            if keys:
                return bool(await self._client.delete(*keys))
            return True
            
        except RedisError as e:
            self._stats['errors'] += 1
            raise CacheError(
                message=f"Cache clear error: {str(e)}",
                error_code="CACHE005",
                metadata={"pattern": pattern}
            )

    async def health_check(self, check_cluster: bool = True) -> Dict:
        """Comprehensive cache health verification.
        
        Args:
            check_cluster: Whether to check cluster health
            
        Returns:
            Detailed health status
        """
        try:
            # Basic connection check
            await self._client.ping()
            
            status = {
                "status": "healthy",
                "connection": "active",
                "stats": self._stats,
                "memory_usage": await self._client.info("memory"),
                "cluster_enabled": self._settings.cluster_mode
            }
            
            # Check cluster health if enabled
            if check_cluster and self._settings.cluster_mode:
                cluster_nodes = self._settings.get_cluster_nodes()
                status["cluster"] = {
                    "nodes": len(cluster_nodes),
                    "node_status": cluster_nodes
                }
            
            return status
            
        except RedisError as e:
            raise CacheError(
                message=f"Health check failed: {str(e)}",
                error_code="CACHE006",
                metadata={"cluster_mode": self._settings.cluster_mode}
            )