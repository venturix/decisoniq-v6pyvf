"""
Repository initialization module for the Customer Success AI Platform.
Provides centralized access to all data persistence operations with enterprise-grade
performance optimization, security, and documentation standards.

Version: 1.0.0
Author: Customer Success AI Platform Team
"""

import logging
from typing import Optional, Dict

from db.repositories.users import UserRepository
from db.repositories.customers import CustomerRepository
from db.repositories.playbooks import PlaybookRepository
from db.repositories.risk import RiskRepository

# Configure module logger
logger = logging.getLogger(__name__)

# Module version and metadata
__version__ = "1.0.0"
__author__ = "Customer Success AI Platform Team"

class RepositoryFactory:
    """
    Factory class providing centralized access to all repository instances
    with connection pooling and performance optimization.
    """

    def __init__(self, db_session, cache_client=None):
        """
        Initialize repository factory with database session and optional cache client.

        Args:
            db_session: SQLAlchemy database session
            cache_client: Optional Redis cache client for performance optimization
        """
        self._db = db_session
        self._cache = cache_client
        self._repositories: Dict = {}
        
        # Configure session timeout for sub-3s response requirement
        self._db.execute("SET statement_timeout = '3000ms'")
        
        logger.info(
            "Repository factory initialized",
            extra={
                "cache_enabled": cache_client is not None,
                "session_id": id(db_session)
            }
        )

    @property
    def users(self) -> UserRepository:
        """
        Get or create UserRepository instance with connection pooling.
        
        Returns:
            UserRepository: Repository for user data operations
        """
        if 'users' not in self._repositories:
            self._repositories['users'] = UserRepository(
                db_session=self._db,
                cache_client=self._cache
            )
        return self._repositories['users']

    @property
    def customers(self) -> CustomerRepository:
        """
        Get or create CustomerRepository instance with risk assessment integration.
        
        Returns:
            CustomerRepository: Repository for customer data operations
        """
        if 'customers' not in self._repositories:
            self._repositories['customers'] = CustomerRepository(
                db_session=self._db,
                cache_client=self._cache
            )
        return self._repositories['customers']

    @property
    def playbooks(self) -> PlaybookRepository:
        """
        Get or create PlaybookRepository instance with workflow automation support.
        
        Returns:
            PlaybookRepository: Repository for playbook operations
        """
        if 'playbooks' not in self._repositories:
            self._repositories['playbooks'] = PlaybookRepository(
                db_session=self._db,
                cache_client=self._cache
            )
        return self._repositories['playbooks']

    @property
    def risk(self) -> RiskRepository:
        """
        Get or create RiskRepository instance with ML model integration.
        
        Returns:
            RiskRepository: Repository for risk assessment operations
        """
        if 'risk' not in self._repositories:
            self._repositories['risk'] = RiskRepository(
                db_session=self._db,
                cache_client=self._cache
            )
        return self._repositories['risk']

    def cleanup(self) -> None:
        """
        Cleanup repository connections and cache clients.
        Should be called when shutting down the application.
        """
        try:
            # Clear all repository instances
            self._repositories.clear()
            
            # Close database session
            if self._db:
                self._db.close()
            
            # Close cache connection if exists
            if self._cache:
                self._cache.close()
                
            logger.info("Repository factory cleanup completed successfully")
            
        except Exception as e:
            logger.error(f"Error during repository cleanup: {str(e)}")
            raise

# Export repository classes for direct imports
__all__ = [
    'RepositoryFactory',
    'UserRepository',
    'CustomerRepository',
    'PlaybookRepository',
    'RiskRepository'
]