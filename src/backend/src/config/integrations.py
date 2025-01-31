"""
Integration configuration module for Customer Success AI Platform.
Manages third-party service integrations including CRM, calendar, billing,
and other enterprise system connections.

Dependencies:
- pydantic==2.x
- python-dotenv==1.0.0
"""

from typing import Dict, Any, List, Optional
import os
from pydantic import dataclasses
from dotenv import load_dotenv

from .settings import env, debug

# Load environment variables
load_dotenv(override=True)

# Global integration settings
DEFAULT_TIMEOUT: int = 30
DEFAULT_RETRY_COUNT: int = 3
DEFAULT_CIRCUIT_BREAKER_THRESHOLD: int = 5
DEFAULT_BACKOFF_FACTOR: float = 1.5

@dataclasses.dataclass
class BaseIntegrationSettings:
    """Base class for all integration settings with common functionality."""
    
    rate_limit: int = 1000
    burst_limit: int = 1500
    timeout: int = DEFAULT_TIMEOUT
    retry_count: int = DEFAULT_RETRY_COUNT
    backoff_factor: float = DEFAULT_BACKOFF_FACTOR
    circuit_breaker_enabled: bool = True
    circuit_breaker_threshold: int = DEFAULT_CIRCUIT_BREAKER_THRESHOLD

    def validate_settings(self) -> bool:
        """Validates integration settings."""
        if self.rate_limit <= 0 or self.burst_limit <= 0:
            raise ValueError("Rate limits must be positive")
        if self.timeout <= 0:
            raise ValueError("Timeout must be positive")
        if self.retry_count < 0:
            raise ValueError("Retry count must be non-negative")
        if self.backoff_factor <= 0:
            raise ValueError("Backoff factor must be positive")
        return True

@dataclasses.dataclass
class SalesforceSettings(BaseIntegrationSettings):
    """Configuration settings for Salesforce CRM integration."""
    
    client_id: str = os.getenv("SALESFORCE_CLIENT_ID", "")
    client_secret: str = os.getenv("SALESFORCE_CLIENT_SECRET", "")
    username: str = os.getenv("SALESFORCE_USERNAME", "")
    password: str = os.getenv("SALESFORCE_PASSWORD", "")
    security_token: str = os.getenv("SALESFORCE_SECURITY_TOKEN", "")
    domain: str = os.getenv("SALESFORCE_DOMAIN", "login.salesforce.com")
    rate_limit: int = 1000
    burst_limit: int = 1500
    timeout: int = 30
    retry_count: int = 3
    custom_fields_mapping: Dict[str, str] = dataclasses.field(default_factory=dict)
    sync_objects: List[str] = dataclasses.field(default_factory=lambda: [
        "Account", "Contact", "Opportunity", "Contract"
    ])

    def get_auth_config(self) -> Dict[str, Any]:
        """Returns authentication configuration."""
        return {
            "grant_type": "password",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "username": self.username,
            "password": self.password + self.security_token,
            "domain": self.domain
        }

@dataclasses.dataclass
class GoogleCalendarSettings(BaseIntegrationSettings):
    """Configuration settings for Google Calendar integration."""
    
    client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    redirect_uri: str = os.getenv("GOOGLE_REDIRECT_URI", "")
    scopes: List[str] = dataclasses.field(default_factory=lambda: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events"
    ])
    rate_limit: int = 200
    burst_limit: int = 300
    timeout: int = 20
    retry_count: int = 3
    calendar_mapping: Dict[str, str] = dataclasses.field(default_factory=dict)

    def get_oauth_config(self) -> Dict[str, Any]:
        """Returns OAuth2 configuration."""
        return {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "scopes": self.scopes
        }

@dataclasses.dataclass
class IntegrationSettings:
    """Main configuration class for all third-party integrations."""
    
    salesforce: SalesforceSettings = dataclasses.field(default_factory=SalesforceSettings)
    calendar: GoogleCalendarSettings = dataclasses.field(default_factory=GoogleCalendarSettings)
    retry_policies: Dict[str, Dict[str, Any]] = dataclasses.field(default_factory=lambda: {
        "exponential": {
            "base_delay": 1,
            "max_delay": 60,
            "max_retries": DEFAULT_RETRY_COUNT
        },
        "linear": {
            "delay": 5,
            "max_retries": DEFAULT_RETRY_COUNT
        }
    })
    timeout_configs: Dict[str, int] = dataclasses.field(default_factory=lambda: {
        "default": DEFAULT_TIMEOUT,
        "long_running": 120,
        "quick": 10
    })
    circuit_breaker_states: Dict[str, bool] = dataclasses.field(default_factory=dict)
    integration_health: Dict[str, Dict[str, Any]] = dataclasses.field(default_factory=dict)

    def get_integration_config(self, integration_name: str) -> Dict[str, Any]:
        """Returns complete integration configuration."""
        if not hasattr(self, integration_name):
            raise ValueError(f"Unknown integration: {integration_name}")

        integration_settings = getattr(self, integration_name)
        integration_settings.validate_settings()

        config = {
            "settings": integration_settings,
            "retry_policy": self.retry_policies["exponential"],
            "timeout": self.timeout_configs["default"],
            "circuit_breaker": {
                "enabled": integration_settings.circuit_breaker_enabled,
                "threshold": integration_settings.circuit_breaker_threshold,
                "state": self.circuit_breaker_states.get(integration_name, True)
            },
            "health": self.integration_health.get(integration_name, {
                "status": "healthy",
                "last_check": None,
                "error_count": 0
            })
        }

        if debug:
            config["debug_mode"] = True
            config["verbose_logging"] = True

        return config

# Create singleton instance
integration_settings = IntegrationSettings()