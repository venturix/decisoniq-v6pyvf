"""
Pytest configuration and fixtures for Customer Success AI Platform backend tests.
Provides secure test environment setup, performance monitoring, and mock objects
for Blitzy platform integration.

Dependencies:
- pytest==7.x
- sqlalchemy==2.x
- fastapi==0.100+
- alembic==1.12+
- datadog==1.x
"""

import os
import pytest
import logging
from typing import Generator, Dict, Any
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from fastapi.testclient import TestClient
from alembic.config import Config
from alembic import command
import datadog

from src.config.settings import env, debug, test_config
from src.db.session import get_db
from src.db.base import Base

# Configure test logging
logging.basicConfig(level=logging.DEBUG if debug else logging.INFO)
logger = logging.getLogger(__name__)

# Test database configuration
TEST_DB_URL = 'postgresql://test:test@localhost:5432/test_db'

# Performance monitoring thresholds
PERFORMANCE_THRESHOLDS = {
    'response_time': 3.0,  # 3 second SLA requirement
    'uptime': 0.999,  # 99.9% uptime requirement
    'query_timeout': 3000  # 3 second query timeout
}

# Test data security configuration
TEST_DATA_CONFIG = {
    'mask_pii': True,
    'refresh_interval': 3600,
    'sensitive_fields': ['password', 'token', 'key']
}

def pytest_configure(config: pytest.Config) -> None:
    """
    Enhanced pytest configuration hook for setting up secure test environment
    with performance monitoring.
    """
    # Initialize Datadog APM for test performance monitoring
    datadog.initialize(
        api_key=os.getenv('DD_API_KEY'),
        app_key=os.getenv('DD_APP_KEY'),
        host_name='test-environment'
    )

    # Configure test environment
    os.environ['APP_ENV'] = 'test'
    os.environ['TEST_DB_URL'] = TEST_DB_URL
    
    # Set up performance monitoring
    datadog.statsd.gauge('test.setup.start', 1)
    
    logger.info(
        "Test environment configured",
        extra={
            'environment': 'test',
            'performance_thresholds': PERFORMANCE_THRESHOLDS,
            'security_config': TEST_DATA_CONFIG
        }
    )

def pytest_sessionstart(session: pytest.Session) -> None:
    """
    Session startup hook with enhanced database initialization and security.
    """
    # Create test database engine
    engine = create_engine(TEST_DB_URL)
    
    try:
        # Drop and recreate test database
        with engine.connect() as conn:
            conn.execute(text("DROP DATABASE IF EXISTS test_db"))
            conn.execute(text("CREATE DATABASE test_db"))
        
        # Run migrations
        alembic_cfg = Config("alembic.ini")
        alembic_cfg.set_main_option("sqlalchemy.url", TEST_DB_URL)
        command.upgrade(alembic_cfg, "head")
        
        # Initialize test database
        Base.metadata.create_all(bind=engine)
        
        logger.info("Test database initialized successfully")
        
    except Exception as e:
        logger.error(f"Test database initialization failed: {str(e)}")
        raise

@pytest.fixture(scope="session")
def db_session() -> Generator[Session, None, None]:
    """
    Provides monitored test database session with security context.
    """
    engine = create_engine(TEST_DB_URL)
    TestingSessionLocal = sessionmaker(bind=engine)
    
    try:
        session = TestingSessionLocal()
        
        # Configure secure session
        session.execute(text("SET statement_timeout = '3000'"))  # 3s timeout
        session.execute(text("SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED"))
        
        yield session
        
        session.rollback()
        session.close()
        
    except Exception as e:
        logger.error(f"Database session error: {str(e)}")
        raise

@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """
    Provides instrumented FastAPI test client with performance tracking.
    """
    from main import app  # Import here to avoid circular imports
    
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        # Track request performance
        start_time = datetime.now()
        
        yield test_client
        
        # Record request duration
        duration = (datetime.now() - start_time).total_seconds()
        datadog.statsd.histogram('test.request.duration', duration)

@pytest.fixture(scope="session")
def test_app(db_session: Session):
    """
    Provides configured test application with security and monitoring.
    """
    from main import app
    
    # Configure test app settings
    app.state.test_mode = True
    app.state.performance_monitoring = True
    
    return app

@pytest.fixture(scope="session")
def performance_metrics() -> Dict[str, Any]:
    """
    Provides test performance monitoring utilities.
    """
    return {
        'start_time': datetime.now(),
        'request_count': 0,
        'error_count': 0,
        'response_times': [],
        'thresholds': PERFORMANCE_THRESHOLDS
    }

@pytest.fixture(scope="function")
def blitzy_mocks(monkeypatch):
    """
    Provides Blitzy platform service mocks.
    """
    class BlitzyServiceMock:
        def __init__(self):
            self.calls = []
        
        def record_call(self, method: str, *args, **kwargs):
            self.calls.append({
                'method': method,
                'args': args,
                'kwargs': kwargs,
                'timestamp': datetime.now()
            })
    
    mocks = {
        'page_builder': BlitzyServiceMock(),
        'tables': BlitzyServiceMock(),
        'ai_builder': BlitzyServiceMock(),
        'automation': BlitzyServiceMock()
    }
    
    # Patch Blitzy service imports
    for service_name, mock in mocks.items():
        monkeypatch.setattr(f"src.integrations.blitzy.{service_name}", mock)
    
    return mocks