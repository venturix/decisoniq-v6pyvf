"""
Schema initialization module for Customer Success AI Platform.
Provides centralized schema exports with version compatibility checks and performance optimization.

Version: 1.0.0
"""

from functools import cache
import logging
from typing import Dict, List, Optional

# Import authentication schemas
from schemas.auth import (
    UserBase, UserCreate, UserLogin, Token, TokenPayload, SSOResponse,
    SecurityAudit, MFASetup, SessionInfo
)

# Import customer schemas
from schemas.customer import (
    CustomerBase, CustomerCreate, CustomerUpdate, CustomerInDB, CustomerResponse,
    METADATA_SCHEMA
)

# Import risk assessment schemas
from schemas.risk import (
    RiskProfileBase, RiskProfileCreate, RiskProfileUpdate, RiskProfileResponse,
    RiskFactorBase, RISK_FACTOR_WEIGHTS
)

# Configure logging
logger = logging.getLogger(__name__)

# Schema version and cache configuration
SCHEMA_VERSION = "1.0.0"
SCHEMA_CACHE_TTL = 3600  # 1 hour cache TTL

# Schema compatibility mapping
SCHEMA_COMPATIBILITY = {
    "1.0.0": ["1.0.0"],  # Current version
    "0.9.0": ["1.0.0"],  # Previous version compatibility
}

@cache(ttl=SCHEMA_CACHE_TTL)
def validate_schema_version(schema_version: str) -> bool:
    """
    Validates schema version compatibility with caching support.
    
    Args:
        schema_version: Version string to validate
        
    Returns:
        bool: True if version is compatible
    """
    try:
        compatible_versions = SCHEMA_COMPATIBILITY.get(SCHEMA_VERSION, [])
        is_compatible = schema_version in compatible_versions
        
        logger.info(
            "Schema version validation",
            extra={
                "schema_version": schema_version,
                "current_version": SCHEMA_VERSION,
                "is_compatible": is_compatible
            }
        )
        
        return is_compatible
    except Exception as e:
        logger.error(
            f"Schema version validation failed: {str(e)}",
            extra={
                "schema_version": schema_version,
                "error": str(e)
            }
        )
        return False

# Export authentication schemas
__auth_schemas__ = {
    "UserBase": UserBase,
    "UserCreate": UserCreate,
    "UserLogin": UserLogin,
    "Token": Token,
    "TokenPayload": TokenPayload,
    "SSOResponse": SSOResponse,
    "SecurityAudit": SecurityAudit,
    "MFASetup": MFASetup,
    "SessionInfo": SessionInfo
}

# Export customer schemas
__customer_schemas__ = {
    "CustomerBase": CustomerBase,
    "CustomerCreate": CustomerCreate,
    "CustomerUpdate": CustomerUpdate,
    "CustomerInDB": CustomerInDB,
    "CustomerResponse": CustomerResponse,
    "METADATA_SCHEMA": METADATA_SCHEMA
}

# Export risk assessment schemas
__risk_schemas__ = {
    "RiskProfileBase": RiskProfileBase,
    "RiskProfileCreate": RiskProfileCreate,
    "RiskProfileUpdate": RiskProfileUpdate,
    "RiskProfileResponse": RiskProfileResponse,
    "RiskFactorBase": RiskFactorBase,
    "RISK_FACTOR_WEIGHTS": RISK_FACTOR_WEIGHTS
}

# Expose all schemas
__all__ = [
    # Authentication schemas
    "UserBase",
    "UserCreate",
    "UserLogin",
    "Token",
    "TokenPayload",
    "SSOResponse",
    "SecurityAudit",
    "MFASetup",
    "SessionInfo",
    
    # Customer schemas
    "CustomerBase",
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerInDB",
    "CustomerResponse",
    "METADATA_SCHEMA",
    
    # Risk assessment schemas
    "RiskProfileBase",
    "RiskProfileCreate",
    "RiskProfileUpdate",
    "RiskProfileResponse",
    "RiskFactorBase",
    "RISK_FACTOR_WEIGHTS",
    
    # Utility functions
    "validate_schema_version"
]

# Schema registry for runtime validation
SCHEMA_REGISTRY = {
    **__auth_schemas__,
    **__customer_schemas__,
    **__risk_schemas__
}