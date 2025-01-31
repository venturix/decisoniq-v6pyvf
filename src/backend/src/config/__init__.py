"""
Configuration initialization module for Customer Success AI Platform backend.
Provides centralized settings management with environment-aware configuration,
secure value handling, and configuration health monitoring.

Dependencies:
- python-dotenv==1.0.0
- pydantic==2.5.2

Version: 1.0.0
"""

import os
import logging
from typing import Dict, Any
from dotenv import load_dotenv

from .settings import Settings
from .database import DatabaseSettings, DatabaseError
from .security import SecuritySettings
from .aws import AWSSettings, aws_settings

# Configure module logger
logger = logging.getLogger(__name__)

def load_environment() -> None:
    """
    Loads and validates environment variables with environment-specific overrides
    and secure handling of sensitive values.
    """
    try:
        # Determine current environment
        env = os.getenv('APP_ENV', 'development')
        
        # Load base .env file
        load_dotenv(dotenv_path='.env', override=True)
        
        # Load environment-specific .env file if exists
        env_file = f'.env.{env}'
        if os.path.exists(env_file):
            load_dotenv(dotenv_path=env_file, override=True)
        
        # Required environment variables
        required_vars = [
            'DB_HOST',
            'DB_PORT',
            'DB_NAME',
            'DB_USER',
            'DB_PASSWORD',
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_REGION',
            'SECRET_KEY'
        ]
        
        # Validate required environment variables
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        logger.info(f"Environment loaded successfully: {env}")
        
    except Exception as e:
        logger.error(f"Failed to load environment: {str(e)}")
        raise

# Initialize configuration components
load_environment()

# Create settings instance with validated configuration
try:
    settings = Settings()
    
    # Validate database connection
    settings.db.validate_connection()
    
    # Initialize AWS services
    aws_session = aws_settings.get_boto3_session()
    
    # Configure monitoring thresholds
    monitoring_config: Dict[str, Any] = {
        'api_latency_ms': 200,
        'db_query_ms': 100,
        'prediction_latency_ms': 3000,
        'error_rate_threshold': 0.01,
        'health_check_interval': 30
    }
    
    # Configure version tracking
    version_info: Dict[str, str] = {
        'api_version': settings.api_version,
        'config_version': '1.0.0',
        'environment': settings.env
    }
    
    logger.info(
        "Configuration initialized successfully",
        extra={
            'environment': settings.env,
            'api_version': settings.api_version,
            'monitoring_enabled': True,
            'version_info': version_info
        }
    )

except DatabaseError as db_error:
    logger.error(f"Database configuration error: {str(db_error)}")
    raise

except Exception as e:
    logger.error(f"Configuration initialization failed: {str(e)}")
    raise

# Export configuration instance
__all__ = ['settings']