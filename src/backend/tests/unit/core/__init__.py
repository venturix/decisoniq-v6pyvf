"""
Core unit test initialization module for Customer Success AI Platform.
Configures test fixtures, security validation, and performance monitoring
for comprehensive testing of core platform functionality.

Dependencies:
- pytest==7.x
"""

import pytest
from typing import List, Dict

# Test markers for core functionality
TEST_MARKERS: List[str] = [
    'unit',        # Basic unit tests
    'auth',        # Authentication and authorization tests
    'security',    # Security feature tests
    'encryption',  # Data encryption tests
    'error',       # Error handling tests
    'performance', # Performance validation tests
    'integration', # Blitzy integration tests
    'api'         # API endpoint tests
]

# Marker descriptions for documentation
MARKER_DESCRIPTIONS: Dict[str, str] = {
    'unit': 'Basic unit tests for core functionality validation',
    'auth': 'Authentication tests including SSO, JWT, and MFA validation',
    'security': 'Security tests for access control and data protection',
    'encryption': 'Data encryption tests for PII and sensitive data handling',
    'error': 'Error handling and logging validation tests',
    'performance': 'Performance tests ensuring sub-3s response times',
    'integration': 'Blitzy platform integration tests',
    'api': 'API endpoint tests with security validation'
}

def pytest_configure(config: pytest.Config) -> None:
    """
    Configure pytest with custom markers and test environment settings.
    Sets up security context, performance monitoring, and test isolation.

    Args:
        config: pytest configuration object
    """
    # Register core test markers with descriptions
    for marker, description in MARKER_DESCRIPTIONS.items():
        config.addinivalue_line(
            "markers",
            f"{marker}: {description}"
        )

    # Configure test isolation and security boundaries
    config.addinivalue_line(
        "markers",
        "isolated: Mark test as requiring complete isolation"
    )
    
    # Configure security context for authentication tests
    config.addinivalue_line(
        "markers", 
        "security_context: Configure security validation requirements"
    )

    # Configure performance monitoring thresholds
    config.addinivalue_line(
        "markers",
        "performance_threshold: Set maximum execution time in seconds"
    )

    # Configure data security requirements
    config.addinivalue_line(
        "markers",
        "requires_encryption: Mark test as requiring data encryption"
    )

    # Configure error handling validation
    config.addinivalue_line(
        "markers",
        "error_validation: Validate error handling and logging"
    )

    # Configure integration test requirements
    config.addinivalue_line(
        "markers",
        "blitzy_integration: Configure Blitzy platform integration context"
    )

    # Configure API test validation
    config.addinivalue_line(
        "markers",
        "api_validation: Validate API security and performance"
    )

    # Set test environment configuration
    config.option.strict = True
    config.option.strict_markers = True
    config.option.log_cli_level = "INFO"
    config.option.log_cli = True
    config.option.log_cli_format = (
        "%(asctime)s [%(levelname)8s] %(message)s "
        "(%(filename)s:%(lineno)s)"
    )
    config.option.log_cli_date_format = "%Y-%m-%d %H:%M:%S"