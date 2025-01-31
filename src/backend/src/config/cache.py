"""
Redis cache configuration module for Customer Success AI Platform.
Manages cache settings, connection parameters, and TTL policies with support for
cluster mode, SSL, and high availability.

Dependencies:
- pydantic==2.x
- redis==7.x
"""

import os
from typing import Dict, List, Optional, Any
from pydantic import dataclasses
from .settings import env, debug

# Redis connection defaults
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', None)
REDIS_SSL = os.getenv('REDIS_SSL', 'False').lower() == 'true'
REDIS_CLUSTER_MODE = os.getenv('REDIS_CLUSTER_MODE', 'False').lower() == 'true'

# Cache configuration defaults
DEFAULT_TTL = 3600  # 1 hour in seconds
CACHE_TYPES = {
    'prediction': 300,    # 5 minutes for ML predictions
    'customer': 1800,     # 30 minutes for customer data
    'analytics': 3600,    # 1 hour for analytics data
    'session': 7200      # 2 hours for session data
}

# Connection pool settings
MAX_RETRIES = 3
RETRY_DELAY = 1
POOL_SIZE = 10

# Cluster configuration
CLUSTER_NODES_ENV = 'REDIS_CLUSTER_NODES'

@dataclasses.dataclass
class CacheSettings:
    """
    Comprehensive configuration class for Redis cache settings with support for
    cluster mode, SSL, connection pooling, and intelligent TTL management.
    """
    
    # Connection settings
    host: str = REDIS_HOST
    port: int = REDIS_PORT
    password: str = REDIS_PASSWORD
    ssl_enabled: bool = REDIS_SSL
    cluster_mode: bool = REDIS_CLUSTER_MODE
    
    # Cache configuration
    ttl_config: Dict[str, int] = dataclasses.field(default_factory=lambda: CACHE_TYPES)
    
    # Connection pool settings
    pool_size: int = POOL_SIZE
    max_retries: int = MAX_RETRIES
    retry_delay: float = RETRY_DELAY
    
    # SSL configuration
    ssl_config: Dict[str, Any] = dataclasses.field(default_factory=lambda: {
        'ssl_cert_reqs': 'required',
        'ssl_ca_certs': os.getenv('REDIS_SSL_CA_CERTS'),
        'ssl_certfile': os.getenv('REDIS_SSL_CERTFILE'),
        'ssl_keyfile': os.getenv('REDIS_SSL_KEYFILE'),
        'ssl_check_hostname': True
    })
    
    # Cluster configuration
    cluster_nodes: List[str] = dataclasses.field(default_factory=lambda: 
        os.getenv(CLUSTER_NODES_ENV, '').split(',') if os.getenv(CLUSTER_NODES_ENV) else []
    )

    def get_connection_url(self) -> str:
        """
        Generates secure Redis connection URL with support for cluster mode and SSL.
        """
        # Build base URL components
        scheme = 'rediss' if self.ssl_enabled else 'redis'
        auth = f':{self.password}@' if self.password else ''
        
        # Handle cluster mode
        if self.cluster_mode and self.cluster_nodes:
            hosts = ','.join(self.cluster_nodes)
            return f'{scheme}://{auth}{hosts}'
        
        # Single node connection
        return f'{scheme}://{auth}{self.host}:{self.port}'

    def get_ttl(self, cache_type: str, context: Optional[Dict] = None) -> int:
        """
        Returns intelligent TTL for specified cache type with dynamic adjustment.
        
        Args:
            cache_type: Type of cached data (prediction, customer, analytics, session)
            context: Optional context for TTL adjustment (load, time patterns)
        
        Returns:
            Optimized TTL in seconds
        """
        # Get base TTL for cache type
        base_ttl = self.ttl_config.get(cache_type, DEFAULT_TTL)
        
        if not context:
            return base_ttl
            
        # Adjust TTL based on system load
        load_factor = context.get('system_load', 0.5)
        if load_factor > 0.8:  # High load
            return int(base_ttl * 1.5)  # Increase cache duration
        elif load_factor < 0.2:  # Low load
            return int(base_ttl * 0.8)  # Decrease cache duration
            
        # Consider time-based patterns
        if context.get('peak_hours', False):
            return int(base_ttl * 0.7)  # Shorter TTL during peak hours
            
        return base_ttl

    def get_cluster_nodes(self) -> List[Dict[str, Any]]:
        """
        Returns comprehensive list of Redis cluster nodes with health status.
        """
        if not self.cluster_mode:
            return []
            
        nodes = []
        for node in self.cluster_nodes:
            host, port = node.split(':')
            nodes.append({
                'host': host,
                'port': int(port),
                'is_primary': True,  # Will be updated by cluster health check
                'status': 'active',  # Will be updated by health monitoring
                'last_health_check': None
            })
        return nodes

    def validate_ssl_config(self) -> bool:
        """
        Validates SSL configuration and certificate status.
        """
        if not self.ssl_enabled:
            return True
            
        required_files = [
            self.ssl_config['ssl_ca_certs'],
            self.ssl_config['ssl_certfile'],
            self.ssl_config['ssl_keyfile']
        ]
        
        # Verify certificate files exist
        for cert_file in required_files:
            if cert_file and not os.path.exists(cert_file):
                return False
                
        # Additional SSL validation could be added here
        return True