"""
Initialization module for the integrations package that provides secure, scalable,
and monitored integration clients for external services.

Dependencies:
- logging==3.11+
- datadog==0.44.0
- cryptography==40.0.0
- connection_pool==1.2.0
- ratelimit==2.2.1
"""

import logging
from datadog import statsd
from cryptography.fernet import Fernet
from connection_pool import ConnectionPool
from ratelimit import RateLimitDecorator

from .aws.s3 import S3Client
from .aws.sagemaker import SageMakerClient
from .crm.salesforce import SalesforceClient

# Configure module logger
logger = logging.getLogger(__name__)

# Package version
__version__ = '1.0.0'

# Global connection pool settings
CONNECTION_POOL_SIZE = 50
RATE_LIMIT_THRESHOLD = 1000

# Initialize encryption for sensitive data
encryption_key = Fernet.generate_key()
cipher_suite = Fernet(encryption_key)

def encrypt_credentials(value: str) -> bytes:
    """Encrypt sensitive credentials."""
    return cipher_suite.encrypt(value.encode())

def decrypt_credentials(encrypted_value: bytes) -> str:
    """Decrypt sensitive credentials."""
    return cipher_suite.decrypt(encrypted_value).decode()

# Rate limiting decorator
rate_limiter = RateLimitDecorator(
    calls=RATE_LIMIT_THRESHOLD,
    period=3600,  # 1 hour
    raise_on_limit=True
)

# Connection pool manager
connection_pool = ConnectionPool(
    maxsize=CONNECTION_POOL_SIZE,
    timeout=30,
    retry_on_timeout=True
)

# Export integration clients with enhanced monitoring
__all__ = [
    'S3Client',
    'SageMakerClient', 
    'SalesforceClient',
    'encrypt_credentials',
    'decrypt_credentials',
    'rate_limiter',
    'connection_pool'
]

# Initialize monitoring
def init_monitoring():
    """Initialize integration monitoring with Datadog."""
    try:
        statsd.gauge('integrations.pool.size', CONNECTION_POOL_SIZE)
        statsd.gauge('integrations.rate_limit', RATE_LIMIT_THRESHOLD)
        logger.info(
            "Integration monitoring initialized",
            extra={
                'pool_size': CONNECTION_POOL_SIZE,
                'rate_limit': RATE_LIMIT_THRESHOLD
            }
        )
    except Exception as e:
        logger.error(
            f"Failed to initialize monitoring: {str(e)}",
            extra={'error': str(e)}
        )

# Initialize monitoring on module import
init_monitoring()

# Monitor integration health
def check_integration_health():
    """Check health of all integration clients."""
    health_status = {
        's3': {'status': 'unknown', 'latency': 0},
        'sagemaker': {'status': 'unknown', 'latency': 0},
        'salesforce': {'status': 'unknown', 'latency': 0}
    }
    
    try:
        # Check S3 health
        s3_client = S3Client()
        s3_client.list_files('test-bucket', prefix='health-check')
        health_status['s3'] = {'status': 'healthy', 'latency': 0}
        
        # Check SageMaker health
        sagemaker_client = SageMakerClient()
        sagemaker_client.health_check()
        health_status['sagemaker'] = {'status': 'healthy', 'latency': 0}
        
        # Check Salesforce health
        salesforce_client = SalesforceClient()
        salesforce_client.authenticate()
        health_status['salesforce'] = {'status': 'healthy', 'latency': 0}
        
        # Report metrics
        for service, status in health_status.items():
            statsd.gauge(
                f'integrations.health.{service}',
                1 if status['status'] == 'healthy' else 0
            )
            
        logger.info(
            "Integration health check completed",
            extra={'health_status': health_status}
        )
        
    except Exception as e:
        logger.error(
            f"Health check failed: {str(e)}",
            extra={'error': str(e)}
        )
        
    return health_status

# Monitor connection pool metrics
def track_pool_metrics():
    """Track connection pool performance metrics."""
    try:
        pool_stats = connection_pool.get_stats()
        
        statsd.gauge('integrations.pool.active', pool_stats.get('active', 0))
        statsd.gauge('integrations.pool.idle', pool_stats.get('idle', 0))
        statsd.gauge('integrations.pool.total', pool_stats.get('total', 0))
        
        logger.info(
            "Connection pool metrics updated",
            extra={'pool_stats': pool_stats}
        )
        
    except Exception as e:
        logger.error(
            f"Failed to track pool metrics: {str(e)}",
            extra={'error': str(e)}
        )

# Initialize secure credential handling
def init_secure_credentials():
    """Initialize secure credential handling for integrations."""
    try:
        # Generate new encryption key if needed
        if not encryption_key:
            global encryption_key
            encryption_key = Fernet.generate_key()
            
        # Verify encryption functionality
        test_value = "test_credential"
        encrypted = encrypt_credentials(test_value)
        decrypted = decrypt_credentials(encrypted)
        
        assert test_value == decrypted, "Encryption verification failed"
        
        logger.info(
            "Secure credential handling initialized",
            extra={'encryption_verified': True}
        )
        
    except Exception as e:
        logger.error(
            f"Failed to initialize secure credentials: {str(e)}",
            extra={'error': str(e)}
        )
        raise

# Initialize secure credentials on module import
init_secure_credentials()