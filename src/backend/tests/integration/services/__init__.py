"""
Initialization module for service integration tests.
Provides shared test fixtures, utilities and base test configuration for testing core business services
with performance monitoring and validation capabilities.

Dependencies:
- pytest==7.4+
- pytest-asyncio==0.23+
"""

import asyncio
import logging
from datetime import datetime
from typing import AsyncGenerator, Dict, Optional

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import DatabaseSession
from src.core.exceptions import BaseCustomException
from src.config.settings import settings

# Configure test logger
logger = logging.getLogger(__name__)

# Test timeouts and thresholds (in seconds)
TEST_TIMEOUT = 30
ASYNC_TEST_TIMEOUT = 60
PERFORMANCE_THRESHOLD_MS = 3000  # 3s SLA requirement
CLEANUP_TIMEOUT = 10

@pytest.fixture(scope="function")
@pytest_asyncio.fixture
async def setup_test_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Creates test database session fixture with performance monitoring.
    
    Yields:
        AsyncSession: Database session for tests with performance tracking
    """
    try:
        # Initialize test database connection with performance monitoring
        start_time = datetime.now()
        
        async with DatabaseSession() as session:
            # Configure session for optimal performance
            await session.execute("SET statement_timeout = '3000'")  # 3s timeout per spec
            await session.execute("SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED")
            
            # Track session creation time
            setup_duration = (datetime.now() - start_time).total_seconds() * 1000
            if setup_duration > PERFORMANCE_THRESHOLD_MS:
                logger.warning(f"Session setup exceeded performance threshold: {setup_duration}ms")
            
            yield session
            
            # Validate cleanup completion within timeout
            cleanup_start = datetime.now()
            await session.rollback()
            
            cleanup_duration = (datetime.now() - cleanup_start).total_seconds()
            if cleanup_duration > CLEANUP_TIMEOUT:
                logger.error(f"Session cleanup exceeded timeout: {cleanup_duration}s")
                
    except Exception as e:
        logger.error(f"Test database setup failed: {str(e)}")
        raise

@pytest.fixture(scope="function")
async def mock_ml_predictions():
    """
    Creates mock ML prediction service fixture with timing validation.
    
    Returns:
        AsyncMock: Mocked ML prediction service with performance characteristics
    """
    from unittest.mock import AsyncMock
    
    # Create async mock with timing capabilities
    mock_service = AsyncMock()
    
    # Configure mock prediction responses with latency simulation
    async def timed_predict(*args, **kwargs):
        start_time = datetime.now()
        
        # Simulate prediction latency
        await asyncio.sleep(0.1)
        
        # Validate prediction time
        duration = (datetime.now() - start_time).total_seconds() * 1000
        if duration > PERFORMANCE_THRESHOLD_MS:
            logger.warning(f"ML prediction exceeded performance threshold: {duration}ms")
            
        return {"prediction": 0.85, "latency_ms": duration}
    
    mock_service.predict = timed_predict
    return mock_service

@pytest.mark.integration
@pytest.mark.performance
class BaseServiceTest:
    """
    Enhanced base class for all service integration tests with performance monitoring.
    Provides common test utilities and performance validation.
    """
    
    def __init__(self):
        """Initialize base test class with performance monitoring."""
        self.db_session: Optional[AsyncSession] = None
        self.test_config = settings.get_app_settings()
        self.metrics: Dict = {
            "test_count": 0,
            "performance_violations": 0,
            "total_duration": 0
        }
        self.mock_manager = None

    async def setup_method(self, method):
        """
        Enhanced setup method with performance monitoring.
        
        Args:
            method: Test method being executed
        """
        start_time = datetime.now()
        
        try:
            # Initialize test database session
            self.db_session = await setup_test_db().__anext__()
            
            # Reset metrics for new test
            self.metrics["test_count"] += 1
            self.metrics["start_time"] = start_time
            
            # Configure mock services
            self.mock_manager = await mock_ml_predictions()
            
        except Exception as e:
            logger.error(f"Test setup failed: {str(e)}")
            raise BaseCustomException(
                message=f"Test setup failed: {str(e)}",
                error_code="TEST001"
            )

    async def teardown_method(self, method):
        """
        Enhanced cleanup method with validation.
        
        Args:
            method: Test method being executed
        """
        try:
            # Calculate test duration
            duration = (datetime.now() - self.metrics["start_time"]).total_seconds() * 1000
            self.metrics["total_duration"] += duration
            
            # Check performance threshold
            if duration > PERFORMANCE_THRESHOLD_MS:
                self.metrics["performance_violations"] += 1
                logger.warning(f"Test exceeded performance threshold: {duration}ms")
            
            # Cleanup database session
            if self.db_session:
                await self.db_session.close()
            
            # Reset mock states
            if self.mock_manager:
                self.mock_manager.reset_mock()
                
            # Log test metrics
            logger.info(
                "Test completed",
                extra={
                    "duration_ms": duration,
                    "performance_metrics": self.metrics
                }
            )
            
        except Exception as e:
            logger.error(f"Test cleanup failed: {str(e)}")
            raise BaseCustomException(
                message=f"Test cleanup failed: {str(e)}",
                error_code="TEST002"
            )

# Export test utilities
__all__ = ['BaseServiceTest', 'setup_test_db', 'mock_ml_predictions']