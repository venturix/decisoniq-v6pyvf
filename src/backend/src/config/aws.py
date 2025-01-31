"""
AWS Configuration Module

Manages settings and credentials for AWS services including SageMaker, S3, and KMS
used in the Customer Success AI Platform.

Dependencies:
- pydantic==2.5.2
- boto3==1.28.44
"""

import os
from typing import Dict, Any
from pydantic import BaseModel, Field
import boto3
from boto3.session import Session

# Global AWS configuration settings
AWS_REGION = os.getenv('AWS_REGION', 'us-west-2')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
ENV = os.getenv('APP_ENV', 'development')

class AWSSettings(BaseModel):
    """AWS configuration settings with validation using Pydantic."""
    
    region: str = Field(default=AWS_REGION)
    access_key_id: str = Field(default=AWS_ACCESS_KEY_ID)
    secret_access_key: str = Field(default=AWS_SECRET_ACCESS_KEY)
    sagemaker_config: Dict[str, Any] = Field(default_factory=dict)
    s3_config: Dict[str, Any] = Field(default_factory=dict)
    kms_config: Dict[str, Any] = Field(default_factory=dict)

    def __init__(self, **data):
        """Initialize AWS settings with environment-specific configurations."""
        super().__init__(**data)
        self.sagemaker_config = self.get_sagemaker_config()
        self.s3_config = self.get_s3_config()
        self.kms_config = self.get_kms_config()

    def get_sagemaker_config(self) -> Dict[str, Any]:
        """Returns SageMaker-specific configuration including instance types and endpoints."""
        is_prod = ENV == 'production'
        
        return {
            'instance_type': 'ml.c5.xlarge' if is_prod else 'ml.t3.medium',
            'instance_count': {
                'min': 1,
                'max': 4 if is_prod else 2
            },
            'model_retention_days': 90 if is_prod else 7,
            'endpoint_config': {
                'instance_type': 'ml.c5.xlarge' if is_prod else 'ml.t3.medium',
                'initial_instance_count': 1,
                'variant_name': 'AllTraffic',
                'autoscaling': {
                    'min_capacity': 1,
                    'max_capacity': 4 if is_prod else 2,
                    'target_value': 70.0,
                    'scale_in_cooldown': 300,
                    'scale_out_cooldown': 60
                }
            },
            'monitoring': {
                'enable_model_monitor': is_prod,
                'monitoring_schedule': '0 */6 * * ? *' if is_prod else '0 0 * * ? *',
                'enable_capture': is_prod,
                'sampling_percentage': 20 if is_prod else 100
            },
            'inference': {
                'timeout_ms': 30000,
                'max_concurrent_invocations': 10 if is_prod else 5,
                'max_payload_size': 6 * 1024 * 1024  # 6MB
            }
        }

    def get_s3_config(self) -> Dict[str, Any]:
        """Returns S3 bucket configuration with lifecycle policies."""
        bucket_prefix = f"cs-ai-platform-{ENV}"
        
        return {
            'buckets': {
                'models': f"{bucket_prefix}-models",
                'artifacts': f"{bucket_prefix}-artifacts",
                'training': f"{bucket_prefix}-training"
            },
            'lifecycle_rules': {
                'transition_days': 30,
                'expiration_days': 90 if ENV == 'production' else 30,
                'glacier_transition': True if ENV == 'production' else False
            },
            'versioning': {
                'enabled': ENV == 'production',
                'mfa_delete': ENV == 'production'
            },
            'encryption': {
                'algorithm': 'AES256',
                'kms_key': '${KMS_KEY_ARN}' if ENV == 'production' else None
            },
            'cors': {
                'allowed_origins': ['*'],
                'allowed_methods': ['GET', 'PUT', 'POST'],
                'allowed_headers': ['*'],
                'max_age_seconds': 3600
            },
            'backup': {
                'enabled': ENV == 'production',
                'retention_days': 90 if ENV == 'production' else 7,
                'schedule': 'cron(0 5 ? * * *)'
            }
        }

    def get_kms_config(self) -> Dict[str, Any]:
        """Returns KMS configuration for encryption management."""
        return {
            'key_rotation': {
                'enabled': True,
                'rotation_interval_days': 90
            },
            'encryption_context': {
                'application': 'cs-ai-platform',
                'environment': ENV,
                'service': '${SERVICE_NAME}'
            },
            'key_policy': {
                'multi_region': ENV == 'production',
                'deletion_window_days': 30 if ENV == 'production' else 7,
                'enable_key_rotation': True
            },
            'key_usage': {
                'encryption_algorithms': ['SYMMETRIC_DEFAULT'],
                'key_spec': 'SYMMETRIC_DEFAULT',
                'key_usage': 'ENCRYPT_DECRYPT'
            },
            'access_control': {
                'key_admins': ['arn:aws:iam::${ACCOUNT_ID}:role/CSAIPlatformKeyAdmin'],
                'key_users': ['arn:aws:iam::${ACCOUNT_ID}:role/CSAIPlatformService']
            },
            'monitoring': {
                'enable_key_logging': True,
                'cloudwatch_retention_days': 90 if ENV == 'production' else 30
            }
        }

    def get_boto3_session(self) -> Session:
        """Creates and returns a configured boto3 session."""
        session = boto3.Session(
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            region_name=self.region
        )

        # Configure retry strategy
        config = boto3.client('config')
        config.meta.config.retries = {
            'max_attempts': 5,
            'mode': 'adaptive'
        }

        # Configure connection pooling
        config.meta.config.max_pool_connections = 50

        return session

# Create singleton instance of AWS settings
aws_settings = AWSSettings()

# Export commonly used configurations
region = aws_settings.region
sagemaker_config = aws_settings.sagemaker_config
s3_config = aws_settings.s3_config
kms_config = aws_settings.kms_config
get_boto3_session = aws_settings.get_boto3_session