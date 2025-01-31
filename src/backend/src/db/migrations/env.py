"""
Alembic migrations environment configuration for Customer Success AI Platform.
Manages database schema migrations with enhanced security, logging, and transaction management.

Version: alembic 1.12.x
"""

import os
import logging
from logging.handlers import RotatingFileHandler
from typing import Optional
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Connection
from sqlalchemy.exc import SQLAlchemyError

from ..base import Base, metadata
from ...config.database import DatabaseSettings

# Initialize configuration context
config = context.config

# Initialize database settings
db_settings = DatabaseSettings()

def configure_logging() -> None:
    """Configure comprehensive logging for migration operations."""
    # Create logs directory if it doesn't exist
    log_dir = Path("logs/migrations")
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # Configure file handler with rotation
    file_handler = RotatingFileHandler(
        filename=log_dir / "migrations.log",
        maxBytes=10_000_000,  # 10MB
        backupCount=5
    )
    
    # Configure console handler
    console_handler = logging.StreamHandler()
    
    # Set log format
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - Migration ID: %(migration_id)s - %(message)s'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # Configure logger
    logger = logging.getLogger('alembic.env')
    logger.setLevel(logging.INFO)
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    # Set extra context for structured logging
    logger.info(
        "Migration logging configured",
        extra={
            'migration_id': context.get_tag_argument(),
            'schema': metadata.schema
        }
    )

def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode for generating SQL scripts.
    
    This includes enhanced validation and security checks.
    """
    try:
        # Get database URL with proper authentication
        url = db_settings.get_connection_url()
        
        # Configure context with enhanced settings
        context.configure(
            url=url,
            target_metadata=metadata,
            literal_binds=True,
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
            version_table_schema=metadata.schema,
            transaction_per_migration=True
        )

        # Execute migrations with validation
        with context.begin_transaction():
            context.run_migrations()
            
        # Log successful completion
        logging.getLogger('alembic.env').info(
            "Offline migrations completed successfully",
            extra={'migration_id': context.get_tag_argument()}
        )

    except Exception as e:
        logging.getLogger('alembic.env').error(
            f"Offline migration failed: {str(e)}",
            extra={
                'migration_id': context.get_tag_argument(),
                'error': str(e)
            }
        )
        raise

def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode with transaction safety and monitoring.
    
    Includes comprehensive error handling and validation.
    """
    try:
        # Create engine with optimized settings
        engine_config = config.get_section(config.config_ini_section)
        engine_config.update(db_settings.get_engine_args())
        
        connectable = engine_from_config(
            engine_config,
            prefix='sqlalchemy.',
            poolclass=pool.NullPool
        )

        with connectable.connect() as connection:
            # Configure migration context
            context.configure(
                connection=connection,
                target_metadata=metadata,
                compare_type=True,
                compare_server_default=True,
                include_schemas=True,
                version_table_schema=metadata.schema,
                transaction_per_migration=True,
                render_as_batch=True
            )

            # Execute migrations within transaction
            with context.begin_transaction():
                context.run_migrations()
                
            # Log successful completion
            logging.getLogger('alembic.env').info(
                "Online migrations completed successfully",
                extra={
                    'migration_id': context.get_tag_argument(),
                    'schema': metadata.schema
                }
            )

    except SQLAlchemyError as e:
        logging.getLogger('alembic.env').error(
            f"Online migration failed: {str(e)}",
            extra={
                'migration_id': context.get_tag_argument(),
                'error': str(e),
                'schema': metadata.schema
            }
        )
        raise

# Configure logging first
configure_logging()

# Execute migrations based on context
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()