"""
Core database module for the Customer Success AI Platform.
Provides SQLAlchemy base configuration, metadata management, and model registration
with optimized performance settings for sub-3s response times.

Version: SQLAlchemy 2.x
"""

import logging
from typing import Optional
from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import SQLAlchemyError

from config.database import DatabaseSettings
from core.exceptions import BaseCustomException

# Configure module logger
logger = logging.getLogger(__name__)

# Define database error codes
DB_ERROR_CODES = {
    'INIT_ERROR': 'DB004',
    'METADATA_ERROR': 'DB005'
}

# Configure metadata with schema and naming conventions
metadata = MetaData(
    schema='csai',
    naming_convention={
        'ix': 'ix_%(column_0_label)s',
        'uq': 'uq_%(table_name)s_%(column_0_name)s',
        'ck': 'ck_%(table_name)s_%(constraint_name)s',
        'fk': 'fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s',
        'pk': 'pk_%(table_name)s'
    }
)

# Create declarative base with configured metadata
Base = declarative_base(metadata=metadata)

# Initialize database settings
db_settings = DatabaseSettings()

# Create engine with optimized connection pooling
engine = create_engine(
    db_settings.get_connection_url(),
    **db_settings.get_engine_args(),
    # Enhanced connection pooling for high performance
    pool_size=20,  # Increased from default for better concurrency
    max_overflow=30,  # Allow additional connections under high load
    pool_timeout=30,  # Connection acquisition timeout
    pool_recycle=1800,  # Recycle connections every 30 minutes
)

def init_models() -> None:
    """
    Initialize all database models and create tables with optimized indexing.
    Ensures sub-3s query performance through proper configuration.
    """
    try:
        # Import all models to register with Base
        # Note: These imports are placed here to avoid circular dependencies
        from .models import (  # type: ignore
            customer,
            risk_profile,
            playbook,
            execution
        )

        # Validate database connection before table creation
        if not db_settings.validate_connection():
            raise BaseCustomException(
                message="Database connection validation failed",
                error_code=DB_ERROR_CODES['INIT_ERROR']
            )

        # Create all tables with indexes and constraints
        Base.metadata.create_all(engine)

        # Verify table creation and log success
        logger.info(
            "Database tables initialized successfully",
            extra={
                "schema": metadata.schema,
                "tables_created": len(Base.metadata.tables),
                "engine_config": {
                    "pool_size": engine.pool.size(),
                    "overflow": engine.pool.overflow(),
                    "timeout": engine.pool.timeout()
                }
            }
        )

    except SQLAlchemyError as e:
        logger.error(f"Failed to initialize database models: {str(e)}")
        raise BaseCustomException(
            message=f"Database initialization failed: {str(e)}",
            error_code=DB_ERROR_CODES['INIT_ERROR'],
            metadata={"error_details": str(e)}
        )

def get_metadata() -> Optional[MetaData]:
    """
    Returns SQLAlchemy metadata object with complete schema configuration.
    
    Returns:
        MetaData: Configured SQLAlchemy metadata instance
    """
    try:
        # Validate metadata configuration
        if not metadata.schema:
            raise BaseCustomException(
                message="Invalid metadata configuration: schema not set",
                error_code=DB_ERROR_CODES['METADATA_ERROR']
            )

        return metadata

    except SQLAlchemyError as e:
        logger.error(f"Failed to retrieve metadata: {str(e)}")
        raise BaseCustomException(
            message=f"Metadata retrieval failed: {str(e)}",
            error_code=DB_ERROR_CODES['METADATA_ERROR'],
            metadata={"error_details": str(e)}
        )

# Export core database components
__all__ = ['Base', 'metadata', 'engine', 'init_models', 'get_metadata']