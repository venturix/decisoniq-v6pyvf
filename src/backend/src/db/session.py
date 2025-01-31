"""
Database session management module for the Customer Success AI Platform.
Provides thread-safe session handling with support for multi-AZ deployments,
connection pooling, and comprehensive error handling.

Version: SQLAlchemy 2.x
"""

import logging
import contextlib
from typing import Generator, Optional
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import event

from .base import Base, engine
from core.exceptions import BaseCustomException

# Configure module logger
logger = logging.getLogger(__name__)

# Database error codes
DB_ERROR_CODES = {
    'SESSION_ERROR': 'DB006',
    'TRANSACTION_ERROR': 'DB007'
}

# Configure session factory with optimized settings
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    # Enhanced connection pooling settings
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800
)

@contextlib.contextmanager
def get_db() -> Generator[Session, None, None]:
    """
    Creates a new database session with automatic cleanup and error handling.
    Implements connection pooling and transaction management for optimal performance.
    
    Yields:
        Session: Database session with configured transaction isolation
    
    Raises:
        BaseCustomException: On session or transaction errors
    """
    session = SessionLocal()
    try:
        logger.debug("Creating new database session", extra={"session_id": id(session)})
        
        # Configure session for optimal performance
        session.execute("SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED")
        session.execute("SET statement_timeout = '3000ms'")  # 3s timeout per spec
        
        yield session
        
        # Commit transaction if no exceptions occurred
        session.commit()
        logger.debug("Session committed successfully", extra={"session_id": id(session)})
        
    except SQLAlchemyError as e:
        logger.error(
            f"Database session error: {str(e)}",
            extra={
                "session_id": id(session),
                "error_details": str(e)
            }
        )
        session.rollback()
        raise BaseCustomException(
            message=f"Database session error: {str(e)}",
            error_code=DB_ERROR_CODES['SESSION_ERROR']
        )
    finally:
        logger.debug("Closing database session", extra={"session_id": id(session)})
        session.close()

def get_read_session() -> Session:
    """
    Creates a read-only database session optimized for queries.
    Configures session for replica reads in multi-AZ deployments.
    
    Returns:
        Session: Read-only database session
    
    Raises:
        BaseCustomException: On session initialization errors
    """
    try:
        session = SessionLocal()
        
        # Configure read-only transaction
        session.execute("SET TRANSACTION READ ONLY")
        session.execute("SET statement_timeout = '3000ms'")
        
        # Enable replica reads if available
        session.execute("SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED")
        
        return session
        
    except SQLAlchemyError as e:
        logger.error(f"Failed to create read session: {str(e)}")
        raise BaseCustomException(
            message=f"Read session creation failed: {str(e)}",
            error_code=DB_ERROR_CODES['SESSION_ERROR']
        )

class DatabaseSession:
    """
    Thread-safe database session context manager with comprehensive lifecycle management.
    Supports both read-write and read-only sessions with proper transaction isolation.
    """
    
    def __init__(self, read_only: bool = False):
        """
        Initialize database session context.
        
        Args:
            read_only (bool): Whether to create a read-only session
        """
        self._session: Optional[Session] = None
        self._read_only = read_only
        self._metrics = {
            'created_at': None,
            'transaction_count': 0,
            'error_count': 0
        }

    def __enter__(self) -> Session:
        """
        Enter session context with proper initialization and monitoring.
        
        Returns:
            Session: Configured database session
        
        Raises:
            BaseCustomException: On session initialization errors
        """
        try:
            logger.debug(
                "Entering database session context",
                extra={"read_only": self._read_only}
            )
            
            # Create appropriate session type
            self._session = get_read_session() if self._read_only else SessionLocal()
            
            # Configure session parameters
            if self._read_only:
                self._session.execute("SET TRANSACTION READ ONLY")
            
            self._session.execute("SET statement_timeout = '3000ms'")
            
            return self._session
            
        except SQLAlchemyError as e:
            logger.error(f"Session context initialization failed: {str(e)}")
            raise BaseCustomException(
                message=f"Session context initialization failed: {str(e)}",
                error_code=DB_ERROR_CODES['SESSION_ERROR']
            )

    def __exit__(self, exc_type, exc_val, exc_tb):
        """
        Exit session context with proper cleanup and error handling.
        
        Args:
            exc_type: Exception type if an error occurred
            exc_val: Exception value if an error occurred
            exc_tb: Exception traceback if an error occurred
        """
        if not self._session:
            return
            
        try:
            if exc_type is not None:
                logger.error(
                    f"Error in session context: {str(exc_val)}",
                    extra={"error_type": exc_type.__name__}
                )
                self._session.rollback()
                self._metrics['error_count'] += 1
            elif not self._read_only:
                self._session.commit()
                self._metrics['transaction_count'] += 1
                
        except SQLAlchemyError as e:
            logger.error(f"Session cleanup error: {str(e)}")
            self._session.rollback()
            raise BaseCustomException(
                message=f"Session cleanup failed: {str(e)}",
                error_code=DB_ERROR_CODES['TRANSACTION_ERROR']
            )
        finally:
            self._session.close()
            logger.debug(
                "Session context cleanup completed",
                extra=self._metrics
            )

# Register session lifecycle event handlers
@event.listens_for(Session, 'after_begin')
def receive_after_begin(session, transaction, connection):
    """Log transaction begin events for monitoring."""
    logger.debug("Transaction began", extra={"session_id": id(session)})

@event.listens_for(Session, 'after_commit')
def receive_after_commit(session):
    """Log successful transaction commits."""
    logger.debug("Transaction committed", extra={"session_id": id(session)})

@event.listens_for(Session, 'after_rollback')
def receive_after_rollback(session):
    """Log transaction rollbacks for monitoring."""
    logger.debug("Transaction rolled back", extra={"session_id": id(session)})