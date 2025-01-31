"""
Core utility functions for the Customer Success AI Platform.
Provides common functionality with enhanced security, performance optimization,
and monitoring integration.

Dependencies:
- cachetools==5.3.0
"""

import json
import uuid
import re
from datetime import datetime
from typing import Dict, Any, Optional, Union
from cachetools import TTLCache, cached  # cachetools v5.3.0
from functools import wraps

from core.exceptions import BaseCustomException
from core.logging import log_error
from core.security import SecurityValidator

# Initialize caches
VALIDATION_CACHE = TTLCache(maxsize=1000, ttl=300)  # 5 minute TTL
CUSTOMER_CACHE = TTLCache(maxsize=10000, ttl=300)

# Constants
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
PHONE_PATTERNS = {
    'US': re.compile(r'^\+1[2-9]\d{9}$'),
    'UK': re.compile(r'^\+44[1-9]\d{9}$'),
    'INT': re.compile(r'^\+[1-9]\d{1,14}$')
}

def generate_uuid() -> str:
    """
    Generates a unique identifier using UUID4.
    
    Returns:
        str: UUID string in standard format
    """
    return str(uuid.uuid4())

def format_datetime(dt: datetime) -> str:
    """
    Formats datetime object to ISO format string.
    
    Args:
        dt: Datetime object to format
        
    Returns:
        str: ISO formatted datetime string
        
    Raises:
        ValueError: If dt is None or invalid
    """
    if not dt:
        raise ValueError("Datetime object is required")
    return dt.isoformat()

def parse_datetime(dt_string: str) -> datetime:
    """
    Parses ISO format string to datetime object.
    
    Args:
        dt_string: ISO format datetime string
        
    Returns:
        datetime: Parsed datetime object
        
    Raises:
        ValueError: If dt_string is invalid
    """
    try:
        return datetime.fromisoformat(dt_string)
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid datetime string format: {e}")

@log_error(error_code='JSON001')
def safe_json_loads(json_string: str, required_fields: Optional[Dict[str, type]] = None) -> Dict[str, Any]:
    """
    Safely loads JSON string with enhanced error handling and security validation.
    
    Args:
        json_string: JSON string to parse
        required_fields: Dictionary of required field names and their types
        
    Returns:
        dict: Parsed and validated JSON data
        
    Raises:
        BaseCustomException: If validation fails or JSON is malformed
    """
    # Validate input for malicious content
    SecurityValidator.validate_content(json_string)
    
    try:
        data = json.loads(json_string)
        
        # Validate required fields if specified
        if required_fields:
            for field, field_type in required_fields.items():
                if field not in data:
                    raise ValueError(f"Required field missing: {field}")
                if not isinstance(data[field], field_type):
                    raise TypeError(f"Invalid type for field {field}: expected {field_type.__name__}")
        
        return data
    except json.JSONDecodeError as e:
        raise BaseCustomException(
            message=f"Invalid JSON format: {str(e)}",
            error_code="JSON001"
        )
    except (ValueError, TypeError) as e:
        raise BaseCustomException(
            message=str(e),
            error_code="JSON002"
        )

@cached(cache=CUSTOMER_CACHE)
@log_error(error_code='CUST001')
def validate_customer_id(customer_id: str) -> bool:
    """
    Validates customer ID format and existence with caching.
    
    Args:
        customer_id: Customer ID to validate
        
    Returns:
        bool: Validation result
        
    Raises:
        BaseCustomException: If validation fails
    """
    try:
        # Validate UUID format
        if not UUID_PATTERN.match(customer_id):
            raise ValueError("Invalid customer ID format")
            
        # Additional validation logic would go here
        # e.g., check customer existence in database
        
        return True
    except ValueError as e:
        raise BaseCustomException(
            message=str(e),
            error_code="CUST001"
        )

def calculate_percentage(value: float, total: float) -> float:
    """
    Calculates percentage with safe division handling.
    
    Args:
        value: Numerator value
        total: Denominator value
        
    Returns:
        float: Calculated percentage rounded to 2 decimal places
        
    Raises:
        ValueError: If total is zero or negative
    """
    if total <= 0:
        raise ValueError("Total must be greater than zero")
    return round((value / total) * 100, 2)

class DataValidator:
    """
    Enhanced utility class for data validation operations with caching and security checks.
    """
    
    def __init__(self, validation_patterns: Dict[str, str], cache_ttl: int = 300):
        """
        Initialize data validator with patterns and cache.
        
        Args:
            validation_patterns: Dictionary of validation patterns
            cache_ttl: Cache TTL in seconds (default: 300)
        """
        self._validation_patterns = validation_patterns
        self._validation_cache = TTLCache(maxsize=1000, ttl=cache_ttl)
        self._security_validator = SecurityValidator()

    @cached(cache=VALIDATION_CACHE)
    def validate_email(self, email: str) -> bool:
        """
        Validates email format with enhanced security checks.
        
        Args:
            email: Email address to validate
            
        Returns:
            bool: Validation result
            
        Raises:
            BaseCustomException: If validation fails
        """
        try:
            # Basic format validation
            if not EMAIL_PATTERN.match(email):
                raise ValueError("Invalid email format")
            
            # Security validation
            self._security_validator.validate_content(email)
            
            return True
        except ValueError as e:
            raise BaseCustomException(
                message=str(e),
                error_code="EMAIL001"
            )

    def validate_phone(self, phone: str, country_code: str = 'INT') -> bool:
        """
        Validates phone number format with international support.
        
        Args:
            phone: Phone number to validate
            country_code: Country code for validation pattern
            
        Returns:
            bool: Validation result
            
        Raises:
            BaseCustomException: If validation fails
        """
        try:
            pattern = PHONE_PATTERNS.get(country_code, PHONE_PATTERNS['INT'])
            if not pattern.match(phone):
                raise ValueError(f"Invalid phone format for country code {country_code}")
            
            # Security validation
            self._security_validator.validate_content(phone)
            
            return True
        except ValueError as e:
            raise BaseCustomException(
                message=str(e),
                error_code="PHONE001"
            )