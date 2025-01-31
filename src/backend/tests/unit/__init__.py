"""
Unit test package initialization module for Customer Success AI Platform backend.
Configures test environment with proper isolation, mocking, and performance monitoring.

Dependencies:
- pytest==7.x
- datadog==1.x
"""

import os
import pytest
import logging
from datetime import datetime
from typing import Dict, Any

# Configure test environment settings
UNIT_TEST_ENV = "test"
MOCK_SERVICES = True

# Performance thresholds from technical spec
PERFORMANCE_THRESHOLDS = {
    "response_time": 3.0,  # 3 second SLA requirement
    "uptime": 0.999,  # 99.9% uptime requirement
    "prediction_latency": 3.0,  # 3s prediction time limit
    "query_timeout": 3000  # 3s database timeout
}

# Configure test logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def pytest_configure(config: pytest.Config) -> None:
    """
    Configure pytest for unit testing with proper isolation and monitoring.
    
    Args:
        config: pytest configuration object
    """
    # Set test environment
    os.environ["APP_ENV"] = UNIT_TEST_ENV
    os.environ["TEST_MODE"] = "True"
    
    # Register custom markers
    config.addinivalue_line("markers", "performance: mark test for performance monitoring")
    config.addinivalue_line("markers", "security: mark test for security validation")
    config.addinivalue_line("markers", "integration: mark test requiring service mocks")
    
    # Configure test isolation
    config.option.strict = True
    config.option.strict_markers = True
    
    # Initialize performance monitoring
    if hasattr(config, "workerinput"):
        # Running in xdist worker
        worker_id = config.workerinput["workerid"]
        logger.info(f"Configuring worker {worker_id} for unit tests")
    
    logger.info(
        "Unit test environment configured",
        extra={
            "environment": UNIT_TEST_ENV,
            "mock_services": MOCK_SERVICES,
            "performance_thresholds": PERFORMANCE_THRESHOLDS
        }
    )

# Export test fixtures
UNIT_TEST_FIXTURES: Dict[str, Any] = {
    "mock_services": {
        "blitzy_page_builder": None,
        "blitzy_tables": None,
        "blitzy_ai_builder": None,
        "blitzy_automation": None
    },
    "unit_test_config": {
        "environment": UNIT_TEST_ENV,
        "mock_enabled": MOCK_SERVICES,
        "thresholds": PERFORMANCE_THRESHOLDS
    },
    "performance_monitor": {
        "start_time": datetime.utcnow().isoformat(),
        "request_count": 0,
        "error_count": 0,
        "response_times": [],
        "thresholds": PERFORMANCE_THRESHOLDS
    },
    "security_context": {
        "test_user": "test_user",
        "test_role": "test_role",
        "mock_auth": True,
        "mock_permissions": ["read", "write"]
    }
}

# Initialize test package
__all__ = ["pytest_configure", "UNIT_TEST_FIXTURES"]