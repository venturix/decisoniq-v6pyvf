"""
Core module initialization for Customer Success AI Platform.
Provides a clean, well-documented public API with standardized error handling,
system monitoring, logging components, and performance optimization utilities.

Version: 1.0.0

Dependencies:
- logging==3.11+
- python-json-logger==2.0.7
- datadog==0.44.0
"""

# Version identifier
__version__ = '1.0.0'

# Import standardized exception classes
from .exceptions import (
    BaseCustomException,
    AuthenticationError,
    DataValidationError,
    PredictionServiceError,
    IntegrationSyncError,
    RateLimitError,
    PlaybookExecutionError,
    MLModelError
)

# Import core utilities
from .utils import (
    generate_uuid,
    format_datetime,
    parse_datetime,
    safe_json_loads,
    validate_customer_id,
    calculate_percentage,
    DataValidator
)

# Import logging utilities
from .logging import (
    setup_logger,
    get_logger,
    StructuredLogger
)

# Import security utilities
from .security import (
    encrypt_field,
    decrypt_field,
    FieldEncryption,
    generate_salt,
    derive_key
)

# Public API exports
__all__ = [
    # Version
    '__version__',
    
    # Exception Classes
    'BaseCustomException',
    'AuthenticationError',
    'DataValidationError',
    'PredictionServiceError',
    'IntegrationSyncError',
    'RateLimitError',
    'PlaybookExecutionError',
    'MLModelError',
    
    # Core Utilities
    'generate_uuid',
    'format_datetime',
    'parse_datetime',
    'safe_json_loads',
    'validate_customer_id',
    'calculate_percentage',
    'DataValidator',
    
    # Logging Utilities
    'setup_logger',
    'get_logger',
    'StructuredLogger',
    
    # Security Utilities
    'encrypt_field',
    'decrypt_field',
    'FieldEncryption',
    'generate_salt',
    'derive_key'
]

# Initialize logging for the core module
logger = get_logger(__name__)
logger.info(f"Core module initialized - Version {__version__}")