"""
Base SQLAlchemy model class for the Customer Success AI Platform.
Provides enhanced functionality for all database models with optimized performance,
caching support, and comprehensive audit capabilities.

Version: SQLAlchemy 2.x
"""

from datetime import datetime
import json
import uuid
from typing import Dict, List, Optional, Any

from sqlalchemy import Column, DateTime, Boolean, String, JSON, event
from sqlalchemy.orm import declarative_base, as_declarative, declared_attr, registry
from sqlalchemy.dialects.postgresql import UUID, JSONB

from db.base import metadata

# Global configuration constants
DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"
CACHE_REGION = "model_cache"
DEFAULT_PAGE_SIZE = 100

# Create registry for model mapping
registry = registry()

@as_declarative(metadata=metadata)
class BaseModel:
    """
    Enhanced abstract base model class providing common functionality,
    performance optimization, and audit capabilities for all models.
    """

    # Primary key using UUID for distributed systems
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        index=True,
        comment="Primary key using UUID4"
    )

    # Audit trail columns
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        comment="Timestamp of record creation"
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        comment="Timestamp of last update"
    )

    is_deleted = Column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
        comment="Soft deletion flag"
    )

    # Enhanced audit logging with JSONB for better performance
    audit_log = Column(
        JSONB,
        nullable=False,
        default=list,
        comment="Audit trail of all changes"
    )

    # Partitioning support
    partition_key = Column(
        String,
        nullable=True,
        index=True,
        comment="Optional partition key for large tables"
    )

    # Query optimization hints
    cache_hints = Column(
        JSONB,
        nullable=True,
        default=dict,
        comment="Cache configuration hints"
    )

    def __init__(self, **kwargs):
        """Initialize base model with enhanced default values and configuration."""
        self.id = kwargs.pop('id', uuid.uuid4())
        self.created_at = kwargs.pop('created_at', datetime.utcnow())
        self.updated_at = kwargs.pop('updated_at', datetime.utcnow())
        self.is_deleted = kwargs.pop('is_deleted', False)
        self.audit_log = kwargs.pop('audit_log', [])
        self.partition_key = kwargs.pop('partition_key', None)
        self.cache_hints = kwargs.pop('cache_hints', {
            'region': CACHE_REGION,
            'timeout': 300,  # 5 minutes default cache
            'query_options': ['selectin_polymorphic']
        })

        # Apply any remaining kwargs
        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_dict(
        self,
        exclude_fields: Optional[List[str]] = None,
        include_audit: bool = False
    ) -> Dict[str, Any]:
        """
        Enhanced model serialization with customization options.

        Args:
            exclude_fields: List of fields to exclude from serialization
            include_audit: Whether to include audit log in output

        Returns:
            Dict containing serialized model data
        """
        exclude_fields = exclude_fields or []
        result = {}

        # Get all model attributes
        for key in self.__mapper__.attrs.keys():
            if key not in exclude_fields:
                value = getattr(self, key)
                
                # Handle datetime formatting
                if isinstance(value, datetime):
                    result[key] = value.strftime(DATETIME_FORMAT)
                # Handle UUID conversion
                elif isinstance(value, uuid.UUID):
                    result[key] = str(value)
                # Handle other types
                else:
                    result[key] = value

        # Include audit log if requested
        if include_audit and 'audit_log' not in exclude_fields:
            result['audit_log'] = self.audit_log

        return result

    def update(self, values: Dict[str, Any], updated_by: str) -> None:
        """
        Updates model with audit trail and validation.

        Args:
            values: Dictionary of values to update
            updated_by: Username or ID of user making the update
        """
        # Create audit log entry
        audit_entry = {
            'timestamp': datetime.utcnow().strftime(DATETIME_FORMAT),
            'user': updated_by,
            'changes': {},
            'type': 'UPDATE'
        }

        # Update attributes and track changes
        for key, value in values.items():
            if hasattr(self, key):
                old_value = getattr(self, key)
                if old_value != value:
                    setattr(self, key, value)
                    audit_entry['changes'][key] = {
                        'old': old_value,
                        'new': value
                    }

        # Update timestamp and audit log
        self.updated_at = datetime.utcnow()
        self.audit_log.append(audit_entry)

        # Invalidate cache if configured
        if self.cache_hints and self.cache_hints.get('region'):
            # Cache invalidation would be handled by cache manager
            pass

    def soft_delete(self, deleted_by: str) -> None:
        """
        Marks record as deleted without removal.

        Args:
            deleted_by: Username or ID of user performing deletion
        """
        self.is_deleted = True
        self.updated_at = datetime.utcnow()
        
        # Record deletion in audit log
        audit_entry = {
            'timestamp': datetime.utcnow().strftime(DATETIME_FORMAT),
            'user': deleted_by,
            'type': 'DELETE',
            'changes': {'is_deleted': {'old': False, 'new': True}}
        }
        self.audit_log.append(audit_entry)

    def configure_cache(self, cache_config: Dict[str, Any]) -> None:
        """
        Sets caching strategy for model.

        Args:
            cache_config: Dictionary containing cache configuration
        """
        valid_keys = {'region', 'timeout', 'query_options', 'invalidation_rules'}
        
        # Validate configuration
        if not all(key in valid_keys for key in cache_config.keys()):
            raise ValueError("Invalid cache configuration keys")

        # Update cache hints
        self.cache_hints.update({
            k: v for k, v in cache_config.items()
            if k in valid_keys
        })

    @declared_attr
    def __tablename__(cls) -> str:
        """Generate table name from class name."""
        return f"{cls.__name__.lower()}"

# Register event listeners for enhanced functionality
@event.listens_for(BaseModel, 'before_update', propagate=True)
def timestamp_before_update(mapper, connection, target):
    """Update timestamp before any update."""
    target.updated_at = datetime.utcnow()

@event.listens_for(BaseModel, 'load', propagate=True)
def receive_load(target, context):
    """Handle post-load operations like cache warming."""
    if target.cache_hints and target.cache_hints.get('warm_cache', False):
        # Cache warming would be handled by cache manager
        pass