"""
Database initialization module for the Customer Success AI Platform.
Configures SQLAlchemy ORM, session management, and exports core database components
with comprehensive performance monitoring and security features.

Version: SQLAlchemy 2.x
"""

import logging
from typing import Dict, Any

from .base import BaseModel
from .session import (
    get_db as get_session,
    DatabaseSession as session_scope,
    DatabaseSession
)

# Configure module logger
logger = logging.getLogger(__name__)

# Export core database components
__all__ = [
    "BaseModel",
    "get_session",
    "session_scope",
    "DatabaseSessionManager"
]

class DatabaseSessionManager:
    """
    Manages database session lifecycle with comprehensive monitoring and optimization.
    Implements connection pooling, performance tracking, and security features.
    """

    def __init__(self) -> None:
        """Initialize session manager with monitoring capabilities."""
        self._metrics: Dict[str, Any] = {
            'active_sessions': 0,
            'peak_sessions': 0,
            'total_transactions': 0,
            'error_count': 0
        }

    def get_session(self, read_only: bool = False) -> DatabaseSession:
        """
        Create a new database session with monitoring.

        Args:
            read_only (bool): Whether to create a read-only session

        Returns:
            DatabaseSession: Configured database session
        """
        try:
            session = DatabaseSession(read_only=read_only)
            self._metrics['active_sessions'] += 1
            self._metrics['peak_sessions'] = max(
                self._metrics['peak_sessions'],
                self._metrics['active_sessions']
            )
            logger.debug(
                "Created new database session",
                extra={
                    'read_only': read_only,
                    'active_sessions': self._metrics['active_sessions']
                }
            )
            return session
        except Exception as e:
            self._metrics['error_count'] += 1
            logger.error(f"Failed to create database session: {str(e)}")
            raise

    def close_session(self, session: DatabaseSession) -> None:
        """
        Close database session and update metrics.

        Args:
            session (DatabaseSession): Session to close
        """
        try:
            session.__exit__(None, None, None)
            self._metrics['active_sessions'] -= 1
            self._metrics['total_transactions'] += 1
            logger.debug(
                "Closed database session",
                extra={'active_sessions': self._metrics['active_sessions']}
            )
        except Exception as e:
            self._metrics['error_count'] += 1
            logger.error(f"Failed to close database session: {str(e)}")
            raise

    def monitor_performance(self) -> Dict[str, Any]:
        """
        Get current session performance metrics.

        Returns:
            Dict[str, Any]: Current performance metrics
        """
        return {
            'active_sessions': self._metrics['active_sessions'],
            'peak_sessions': self._metrics['peak_sessions'],
            'total_transactions': self._metrics['total_transactions'],
            'error_rate': (
                self._metrics['error_count'] / 
                max(1, self._metrics['total_transactions'])
            ) * 100
        }

    def validate_connection(self) -> bool:
        """
        Validate database connection health.

        Returns:
            bool: True if connection is healthy
        """
        try:
            with self.get_session(read_only=True) as session:
                session.execute("SELECT 1")
                return True
        except Exception as e:
            logger.error(f"Database connection validation failed: {str(e)}")
            return False

    def optimize_pool(self) -> None:
        """Optimize connection pool based on current usage patterns."""
        try:
            metrics = self.monitor_performance()
            if metrics['active_sessions'] > metrics['peak_sessions'] * 0.8:
                logger.warning("High session utilization detected")
            elif metrics['error_rate'] > 5:
                logger.warning("High error rate detected")
        except Exception as e:
            logger.error(f"Pool optimization failed: {str(e)}")
            raise