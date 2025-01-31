"""
Root initialization module for Customer Success AI Platform backend.
Configures application environment, initializes core components, and exports main application instance.

Dependencies:
- python-dotenv==1.0.0
- logging==3.11+
- structlog==23.1.0
- sentry-sdk==1.29.2

Version: 1.0.0
"""

import os
import logging
from typing import Dict, Any
from dotenv import load_dotenv
import structlog
import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration

from .config import settings, validate_settings
from .api.server import create_application, initialize_security

# Initialize structured logger
logger = structlog.get_logger(__name__)

# Global startup status tracking
startup_status = {
    'initialized': False,
    'health': {},
    'security': {}
}

def init_logging(env: str, log_level: str) -> None:
    """
    Initializes comprehensive application logging with structured formats,
    security auditing, and performance tracking.

    Args:
        env: Application environment (development, staging, production)
        log_level: Logging level to configure
    """
    # Configure structlog with JSON formatting
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configure Sentry error tracking for production
    if env == 'production':
        sentry_sdk.init(
            dsn=os.getenv('SENTRY_DSN'),
            environment=env,
            traces_sample_rate=0.1,
            integrations=[
                LoggingIntegration(
                    level=logging.INFO,
                    event_level=logging.ERROR
                )
            ]
        )

    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(f'logs/csai-platform-{env}.log')
        ]
    )

    logger.info(
        "Logging initialized",
        env=env,
        log_level=log_level,
        structured_logging=True,
        sentry_enabled=env == 'production'
    )

def init_environment() -> Dict[str, Any]:
    """
    Initializes application environment with comprehensive security controls
    and health monitoring.

    Returns:
        Dict containing initialization status and health metrics
    """
    try:
        # Load environment variables
        load_dotenv(override=True)
        env = os.getenv('APP_ENV', 'development')
        log_level = os.getenv('LOG_LEVEL', 'INFO')

        # Initialize logging system
        init_logging(env, log_level)

        # Validate application settings
        validate_settings()

        # Initialize security components
        security_status = initialize_security()

        # Update startup status
        startup_status.update({
            'initialized': True,
            'environment': env,
            'log_level': log_level,
            'security': security_status,
            'health': {
                'status': 'healthy',
                'components_initialized': True,
                'startup_time': structlog.get_timestamp()
            }
        })

        logger.info(
            "Environment initialized successfully",
            startup_status=startup_status
        )

        return startup_status

    except Exception as e:
        logger.error(
            "Environment initialization failed",
            error=str(e),
            exc_info=True
        )
        startup_status.update({
            'initialized': False,
            'error': str(e),
            'health': {'status': 'unhealthy'}
        })
        raise

# Initialize application environment
init_environment()

# Create FastAPI application instance
app = create_application()

# Export application instance and settings
__all__ = ['app', 'settings']