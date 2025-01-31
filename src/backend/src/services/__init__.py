"""
Package initialization file for the Customer Success AI Platform's service layer.
Exposes core service classes that implement business logic for authentication,
customer management, playbook automation, and other key platform functionalities.

Version: 1.0.0
"""

from .auth import AuthService
from .customer import CustomerService
from .playbook import PlaybookService

# Package version
VERSION = "1.0.0"

# Export core service classes
__all__ = [
    "AuthService",
    "CustomerService", 
    "PlaybookService",
    "VERSION"
]