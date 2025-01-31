"""
Database models package initializer for the Customer Success AI Platform.
Configures SQLAlchemy models with performance optimizations, caching support,
and type hints for enterprise-grade data management.

Version: SQLAlchemy 2.x
"""

from typing import Dict, Type, Optional
from sqlalchemy import MetaData
from sqlalchemy.orm import declarative_base
from sqlalchemy_utils import create_view
import logging

# Import core models
from models.base import BaseModel
from models.customer import Customer
from models.risk import RiskProfile

# Configure module logger
logger = logging.getLogger(__name__)

# Initialize model registry
MODEL_REGISTRY: Dict[str, Type[BaseModel]] = {}

# Cache region configuration
CACHE_REGIONS = {
    'customer_cache': {
        'backend': 'dogpile.cache.redis',
        'expiration_time': 300,  # 5 minutes
        'arguments': {
            'host': 'localhost',
            'port': 6379,
            'db': 0,
            'distributed_lock': True
        }
    },
    'risk_profile_cache': {
        'backend': 'dogpile.cache.redis',
        'expiration_time': 300,  # 5 minutes
        'arguments': {
            'host': 'localhost',
            'port': 6379,
            'db': 1,
            'distributed_lock': True
        }
    }
}

def register_model(model_class: Type[BaseModel]) -> None:
    """
    Registers a model class in the model registry with validation and cache configuration.

    Args:
        model_class: SQLAlchemy model class inheriting from BaseModel
    
    Raises:
        ValueError: If model class is invalid or already registered
    """
    # Validate model class
    if not issubclass(model_class, BaseModel):
        raise ValueError(f"Model class {model_class.__name__} must inherit from BaseModel")

    # Check for duplicate registration
    if model_class.__name__ in MODEL_REGISTRY:
        raise ValueError(f"Model {model_class.__name__} is already registered")

    # Register model
    MODEL_REGISTRY[model_class.__name__] = model_class
    
    # Configure model-specific caching
    if hasattr(model_class, 'cache_hints'):
        configure_model_cache(model_class)

    logger.info(
        f"Registered model {model_class.__name__}",
        extra={
            "model_name": model_class.__name__,
            "table_name": model_class.__tablename__,
            "cache_config": getattr(model_class, 'cache_hints', None)
        }
    )

def configure_model_cache(model_class: Type[BaseModel]) -> None:
    """
    Configures caching strategy for a specific model with performance optimization.

    Args:
        model_class: SQLAlchemy model class to configure caching for
    """
    cache_hints = getattr(model_class, 'cache_hints', {})
    cache_region = cache_hints.get('region')

    if cache_region and cache_region in CACHE_REGIONS:
        # Apply cache configuration
        model_class.__cache_region__ = CACHE_REGIONS[cache_region]
        
        # Configure cache invalidation triggers
        model_class.__cache_options__ = {
            'invalidate_on_write': True,
            'distributed_lock': True,
            'lock_timeout': 30,
            'regions': [cache_region]
        }

        logger.info(
            f"Configured caching for {model_class.__name__}",
            extra={
                "model_name": model_class.__name__,
                "cache_region": cache_region,
                "cache_config": CACHE_REGIONS[cache_region]
            }
        )

# Register core models
register_model(Customer)
register_model(RiskProfile)

# Export core components
__all__ = [
    'BaseModel',
    'Customer',
    'RiskProfile',
    'MODEL_REGISTRY',
    'CACHE_REGIONS',
    'register_model',
    'configure_model_cache'
]