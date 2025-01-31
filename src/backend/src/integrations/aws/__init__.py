"""
AWS Integration Initialization Module for Customer Success AI Platform.

Provides enterprise-grade, secure, and performant access to AWS services (S3 and SageMaker)
with comprehensive monitoring, caching, and health check capabilities.

Dependencies:
- boto3==1.28+
- botocore==1.31+
"""

import logging
from typing import Dict, Tuple, Optional
from .s3 import S3Client
from .sagemaker import SageMakerClient

# Configure structured logging
logger = logging.getLogger(__name__)

# Global configuration for AWS client retries and connection pooling
AWS_RETRY_CONFIG = {
    'max_attempts': 3,
    'mode': 'exponential',
    'initial_delay': 1
}

CONNECTION_POOL_CONFIG = {
    'max_size': 100,
    'timeout': 30
}

def initialize_aws_clients(config: Optional[Dict] = None) -> Tuple[S3Client, SageMakerClient]:
    """
    Initializes AWS clients with enterprise configurations including connection pooling,
    retry policies, and monitoring.

    Args:
        config: Optional configuration overrides for AWS clients

    Returns:
        Tuple[S3Client, SageMakerClient]: Configured S3 and SageMaker client instances

    Raises:
        Exception: If client initialization fails
    """
    try:
        # Merge provided config with defaults
        client_config = {
            **AWS_RETRY_CONFIG,
            **(config or {})
        }

        logger.info(
            "Initializing AWS clients",
            extra={
                "retry_config": client_config,
                "pool_config": CONNECTION_POOL_CONFIG
            }
        )

        # Initialize S3 client with enterprise configuration
        s3_client = S3Client(retry_config=client_config)
        
        # Validate S3 client encryption and performance settings
        s3_client.validate_encryption()
        s3_client.monitor_performance()

        # Initialize SageMaker client with enterprise configuration
        sagemaker_client = SageMakerClient()
        
        # Verify SageMaker endpoint health and cache configuration
        sagemaker_client.check_endpoint_health()
        sagemaker_client.manage_prediction_cache()

        logger.info(
            "AWS clients initialized successfully",
            extra={
                "s3_status": "healthy",
                "sagemaker_status": "healthy"
            }
        )

        return s3_client, sagemaker_client

    except Exception as e:
        logger.error(
            "Failed to initialize AWS clients",
            extra={
                "error": str(e),
                "retry_config": client_config
            }
        )
        raise

# Export commonly used client operations
__all__ = [
    'S3Client',
    'SageMakerClient',
    'initialize_aws_clients'
]

# Export specific S3 operations
from .s3 import (
    upload_model,
    download_model,
    archive_data,
    retrieve_archive,
    validate_encryption,
    monitor_performance
)

# Export specific SageMaker operations
from .sagemaker import (
    deploy_model,
    invoke_endpoint,
    update_model,
    monitor_model_metrics,
    check_endpoint_health,
    manage_prediction_cache
)