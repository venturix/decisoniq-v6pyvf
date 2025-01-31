"""
Database integration test initialization module for the Customer Success AI Platform.
Provides test database configuration, session management, and performance monitoring
for comprehensive database testing with proper isolation.

Version: SQLAlchemy 2.x
"""

import logging
import time
from typing import Dict, Generator, Optional
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from src.db.base import Base, metadata
from src.db.session import DatabaseSession
from src.core.exceptions import BaseCustomException

# Configure test logger
logger = logging.getLogger(__name__)

# Test database configuration
TEST_DB_URL = 'postgresql://test:test@localhost:5432/test_db'
PERFORMANCE_THRESHOLD_MS = 3000  # 3s per spec requirement

# Test database error codes
TEST_DB_ERROR_CODES = {
    'TEST_INIT_ERROR': 'TEST001',
    'PERFORMANCE_ERROR': 'TEST002',
    'CLEANUP_ERROR': 'TEST003'
}

class TestDatabaseManager:
    """
    Enhanced test database manager with performance monitoring and isolation.
    Provides comprehensive test database lifecycle management.
    """
    
    def __init__(self, db_url: str, enable_monitoring: bool = True):
        """
        Initialize test database manager with monitoring capabilities.
        
        Args:
            db_url (str): Test database connection URL
            enable_monitoring (bool): Enable performance monitoring
        """
        self._db_url = db_url
        self._enable_monitoring = enable_monitoring
        self._performance_metrics: Dict[str, float] = {}
        
        # Initialize test engine with monitoring
        self._engine = create_engine(
            self._db_url,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
            echo=True
        )
        
        # Configure session factory
        self._session_factory = sessionmaker(
            bind=self._engine,
            autocommit=False,
            autoflush=False
        )
        
        if enable_monitoring:
            self._setup_performance_monitoring()

    def _setup_performance_monitoring(self) -> None:
        """Configure SQL query performance monitoring."""
        @event.listens_for(self._engine, 'before_cursor_execute')
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            conn.info.setdefault('query_start_time', []).append(time.time())

        @event.listens_for(self._engine, 'after_cursor_execute')
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            total_time = (time.time() - conn.info['query_start_time'].pop()) * 1000
            if total_time > PERFORMANCE_THRESHOLD_MS:
                logger.warning(
                    f"Query exceeded performance threshold: {total_time:.2f}ms",
                    extra={
                        "query": statement,
                        "execution_time": total_time
                    }
                )
            self._performance_metrics[statement] = total_time

    def get_session(self, track_performance: bool = True) -> Session:
        """
        Creates new test session with enhanced isolation.
        
        Args:
            track_performance (bool): Enable query performance tracking
            
        Returns:
            Session: Isolated database session
        """
        session = self._session_factory()
        
        # Configure test isolation
        session.execute("SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED")
        session.execute(f"SET statement_timeout = '{PERFORMANCE_THRESHOLD_MS}ms'")
        
        if track_performance and self._enable_monitoring:
            @event.listens_for(session, 'after_transaction_end')
            def after_transaction_end(session, transaction):
                logger.info(
                    "Transaction performance metrics",
                    extra={"metrics": self._performance_metrics}
                )
                
        return session

    def cleanup(self) -> None:
        """
        Comprehensive cleanup of database and monitoring resources.
        """
        try:
            # Close all sessions
            self._session_factory.close_all()
            
            # Clear performance metrics
            self._performance_metrics.clear()
            
            # Dispose engine
            self._engine.dispose()
            
        except SQLAlchemyError as e:
            logger.error(f"Test database cleanup failed: {str(e)}")
            raise BaseCustomException(
                message=f"Test cleanup failed: {str(e)}",
                error_code=TEST_DB_ERROR_CODES['CLEANUP_ERROR']
            )

@pytest.fixture
def create_test_session(enable_performance_monitoring: bool = True) -> Generator[Session, None, None]:
    """
    Creates an isolated database session for testing with performance monitoring.
    
    Args:
        enable_performance_monitoring (bool): Enable query performance tracking
        
    Yields:
        Session: Configured test database session
    """
    manager = TestDatabaseManager(TEST_DB_URL, enable_performance_monitoring)
    session = manager.get_session()
    
    try:
        yield session
    finally:
        session.close()
        manager.cleanup()

@pytest.fixture(scope='session')
def setup_test_db(validate_performance: bool = True) -> None:
    """
    Sets up test database environment with performance baselines.
    
    Args:
        validate_performance (bool): Enable performance validation
    """
    try:
        # Create test database schema
        Base.metadata.create_all(bind=create_engine(TEST_DB_URL))
        
        if validate_performance:
            # Run baseline performance validation
            engine = create_engine(TEST_DB_URL)
            with engine.connect() as conn:
                start_time = time.time()
                conn.execute("SELECT 1")
                execution_time = (time.time() - start_time) * 1000
                
                if execution_time > PERFORMANCE_THRESHOLD_MS:
                    raise BaseCustomException(
                        message=f"Performance baseline exceeded threshold: {execution_time:.2f}ms",
                        error_code=TEST_DB_ERROR_CODES['PERFORMANCE_ERROR']
                    )
                
    except SQLAlchemyError as e:
        logger.error(f"Test database setup failed: {str(e)}")
        raise BaseCustomException(
            message=f"Test setup failed: {str(e)}",
            error_code=TEST_DB_ERROR_CODES['TEST_INIT_ERROR']
        )

@pytest.fixture(scope='session', autouse=True)
def cleanup_test_db() -> None:
    """
    Comprehensive cleanup of test database and monitoring resources.
    """
    yield  # Run tests
    
    try:
        # Drop test database schema
        engine = create_engine(TEST_DB_URL)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        
    except SQLAlchemyError as e:
        logger.error(f"Test database cleanup failed: {str(e)}")
        raise BaseCustomException(
            message=f"Test cleanup failed: {str(e)}",
            error_code=TEST_DB_ERROR_CODES['CLEANUP_ERROR']
        )

# Export test database utilities
__all__ = [
    "create_test_session",
    "TestDatabaseManager",
    "setup_test_db",
    "cleanup_test_db"
]