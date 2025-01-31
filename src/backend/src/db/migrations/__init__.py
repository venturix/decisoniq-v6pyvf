"""
Database migrations package initialization for the Customer Success AI Platform.
Provides version tracking and package information for Alembic-based migrations.

Version: 0.1.0
"""

import pkg_resources
from db.base import metadata

# Package version and name for migration tracking
__version__ = '0.1.0'
__package_name__ = 'csai-platform-migrations'

# Validate metadata configuration
if not metadata.schema:
    raise ValueError("Database schema must be configured in metadata")

# Export version information
__all__ = ['__version__', '__package_name__']