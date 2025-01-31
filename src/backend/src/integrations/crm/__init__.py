"""
CRM integration package initialization module for Customer Success AI Platform.
Provides a unified interface for CRM system integrations with robust error handling,
telemetry, and security features.

Dependencies:
- opentelemetry==1.20.0
"""

from typing import Dict, Optional, Type, Union
from opentelemetry import trace

from .salesforce import SalesforceClient
from config.integrations import integration_settings
from core.telemetry import MetricsTracker, track_metric
from core.logging import get_logger

# Initialize module logger
logger = get_logger(__name__)

# Initialize tracer
tracer = trace.get_tracer(__name__)

# CRM Provider Constants
CRM_PROVIDER_SALESFORCE = 'salesforce'
DEFAULT_CRM_PROVIDER = CRM_PROVIDER_SALESFORCE

# Registry of supported CRM providers
SUPPORTED_CRM_PROVIDERS = {
    CRM_PROVIDER_SALESFORCE: SalesforceClient
}

class CRMIntegrationError(Exception):
    """Enhanced custom exception for CRM integration errors with telemetry."""

    def __init__(
        self,
        message: str,
        error_code: str,
        provider: str,
        context: Optional[Dict] = None,
        original_error: Optional[Exception] = None
    ) -> None:
        """Initialize CRM integration error with enhanced context."""
        super().__init__(message)
        self.error_code = error_code
        self.provider = provider
        self.context = context or {}
        self.original_error = original_error

        # Track error metrics
        track_metric(
            'crm.integration.error',
            1,
            {
                'provider': provider,
                'error_code': error_code,
                'error_type': type(original_error).__name__ if original_error else None
            }
        )

        # Log error with context
        logger.log(
            'error',
            f"CRM Integration Error: {message}",
            extra={
                'error_code': error_code,
                'provider': provider,
                'context': self.context,
                'original_error': str(original_error) if original_error else None
            }
        )

    def to_dict(self) -> Dict:
        """Convert error to dictionary format for logging."""
        return {
            'message': str(self),
            'error_code': self.error_code,
            'provider': self.provider,
            'context': self.context,
            'original_error': str(self.original_error) if self.original_error else None
        }

@trace.instrumentor(name='crm_client_factory')
def get_crm_client(
    provider: str = DEFAULT_CRM_PROVIDER,
    override_settings: Optional[Dict] = None
) -> Union[SalesforceClient]:
    """
    Factory function to get appropriate CRM client instance with security validation,
    telemetry, and error handling.
    """
    with MetricsTracker('crm_client_initialization', {'provider': provider}) as tracker:
        try:
            # Validate CRM provider
            if provider not in SUPPORTED_CRM_PROVIDERS:
                raise CRMIntegrationError(
                    message=f"Unsupported CRM provider: {provider}",
                    error_code="CRM001",
                    provider=provider
                )

            # Get provider configuration
            config = integration_settings.get_integration_config(provider)
            if override_settings:
                config['settings'].update(override_settings)

            # Validate configuration
            if not validate_crm_config(provider, config['settings']):
                raise CRMIntegrationError(
                    message=f"Invalid CRM configuration for provider: {provider}",
                    error_code="CRM002",
                    provider=provider,
                    context={'config': config}
                )

            # Initialize client with monitoring
            client_class = SUPPORTED_CRM_PROVIDERS[provider]
            client = client_class(config['settings'])

            # Track successful initialization
            track_metric(
                'crm.client.initialized',
                1,
                {'provider': provider}
            )

            return client

        except CRMIntegrationError:
            raise
        except Exception as e:
            raise CRMIntegrationError(
                message=f"Failed to initialize CRM client: {str(e)}",
                error_code="CRM003",
                provider=provider,
                original_error=e,
                context={'override_settings': override_settings}
            )

def validate_crm_config(provider: str, settings: Dict) -> bool:
    """Validates CRM configuration settings for security and completeness."""
    try:
        if provider == CRM_PROVIDER_SALESFORCE:
            required_fields = [
                'client_id',
                'client_secret',
                'username',
                'password',
                'security_token'
            ]
            
            # Check required fields
            missing_fields = [
                field for field in required_fields 
                if not settings.get(field)
            ]
            
            if missing_fields:
                raise CRMIntegrationError(
                    message=f"Missing required configuration fields: {missing_fields}",
                    error_code="CRM004",
                    provider=provider,
                    context={'missing_fields': missing_fields}
                )

            # Validate rate limits
            if not (0 < settings.get('rate_limit', 0) <= 1000):
                raise CRMIntegrationError(
                    message="Invalid rate limit configuration",
                    error_code="CRM005",
                    provider=provider,
                    context={'rate_limit': settings.get('rate_limit')}
                )

            # Track validation success
            track_metric(
                'crm.config.validated',
                1,
                {'provider': provider}
            )

            return True

        raise CRMIntegrationError(
            message=f"Validation not implemented for provider: {provider}",
            error_code="CRM006",
            provider=provider
        )

    except CRMIntegrationError:
        raise
    except Exception as e:
        raise CRMIntegrationError(
            message=f"Configuration validation failed: {str(e)}",
            error_code="CRM007",
            provider=provider,
            original_error=e
        )