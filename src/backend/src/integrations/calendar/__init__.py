"""
Calendar integration initialization module for Customer Success AI Platform.
Provides a unified interface for calendar operations with enhanced security,
monitoring, and performance optimizations.

Dependencies:
- pydantic==2.x
- python-dotenv==1.0.0
"""

import logging
import threading
from typing import Dict, Optional, Type
from datetime import datetime
from pydantic import BaseModel, Field

from .google import GoogleCalendarClient
from ...config.integrations import GoogleCalendarSettings
from ...core.exceptions import IntegrationSyncError, RateLimitError

# Module configuration
SUPPORTED_PROVIDERS = ["google"]
DEFAULT_PROVIDER = "google"

# Configure module logger
logger = logging.getLogger(__name__)

class CalendarMetrics(BaseModel):
    """Metrics tracking for calendar operations."""
    requests_count: int = 0
    error_count: int = 0
    last_request_time: Optional[datetime] = None
    average_latency_ms: float = 0.0
    success_rate: float = 100.0

class ProviderHealth(BaseModel):
    """Health status tracking for calendar providers."""
    status: str = "healthy"
    last_check: Optional[datetime] = None
    error_count: int = 0
    consecutive_failures: int = 0
    circuit_breaker_open: bool = False

class CalendarFactory:
    """
    Enhanced factory class for creating and managing calendar client instances
    with comprehensive security, monitoring, and performance features.
    """

    def __init__(self, settings: Dict = None):
        """
        Initialize calendar factory with enhanced settings and monitoring.

        Args:
            settings: Optional dictionary of provider-specific settings
        """
        # Thread-safe client registry
        self._clients: Dict = {}
        self._client_lock = threading.Lock()
        
        # Provider settings and configurations
        self._settings = settings or {}
        self._google_settings = GoogleCalendarSettings()
        
        # Monitoring and metrics
        self._metrics: Dict[str, CalendarMetrics] = {
            provider: CalendarMetrics() for provider in SUPPORTED_PROVIDERS
        }
        self._health_status: Dict[str, ProviderHealth] = {
            provider: ProviderHealth() for provider in SUPPORTED_PROVIDERS
        }
        
        # Initialize supported providers
        self._register_default_providers()

    def _register_default_providers(self) -> None:
        """Register default calendar providers with security validation."""
        try:
            self.register_provider("google", GoogleCalendarClient)
            logger.info("Successfully registered default calendar providers")
        except Exception as e:
            logger.error(f"Failed to register default providers: {str(e)}")
            raise IntegrationSyncError(
                message="Failed to initialize calendar integration",
                sync_context={"service": "calendar", "action": "init"}
            )

    def _update_metrics(self, provider: str, latency_ms: float, success: bool) -> None:
        """Update provider metrics with thread safety."""
        with self._client_lock:
            metrics = self._metrics[provider]
            metrics.requests_count += 1
            metrics.last_request_time = datetime.now()
            
            # Update running average latency
            metrics.average_latency_ms = (
                (metrics.average_latency_ms * (metrics.requests_count - 1) + latency_ms)
                / metrics.requests_count
            )
            
            if not success:
                metrics.error_count += 1
            metrics.success_rate = (
                (metrics.requests_count - metrics.error_count)
                / metrics.requests_count * 100
            )

    def _check_provider_health(self, provider: str) -> bool:
        """Check provider health status and manage circuit breaker."""
        health = self._health_status[provider]
        
        # Update health check timestamp
        health.last_check = datetime.now()
        
        # Check circuit breaker status
        if health.circuit_breaker_open:
            # Implement circuit breaker pattern with exponential backoff
            if (datetime.now() - health.last_check).total_seconds() < (2 ** health.consecutive_failures):
                return False
            
            # Attempt to close circuit breaker
            health.circuit_breaker_open = False
            health.consecutive_failures = 0
        
        return health.status == "healthy"

    def _handle_provider_error(self, provider: str) -> None:
        """Handle provider errors and update health status."""
        with self._client_lock:
            health = self._health_status[provider]
            health.error_count += 1
            health.consecutive_failures += 1
            
            # Open circuit breaker if too many consecutive failures
            if health.consecutive_failures >= 5:
                health.circuit_breaker_open = True
                health.status = "unhealthy"
                logger.warning(f"Circuit breaker opened for provider: {provider}")

    def get_client(self, provider: str = DEFAULT_PROVIDER) -> Optional[GoogleCalendarClient]:
        """
        Returns a validated and monitored calendar client instance.

        Args:
            provider: Calendar provider name (default: "google")

        Returns:
            Calendar client instance with monitoring wrapper

        Raises:
            IntegrationSyncError: If provider is invalid or unavailable
        """
        if provider not in SUPPORTED_PROVIDERS:
            raise IntegrationSyncError(
                message=f"Unsupported calendar provider: {provider}",
                sync_context={"service": "calendar", "provider": provider}
            )

        # Check provider health
        if not self._check_provider_health(provider):
            raise IntegrationSyncError(
                message=f"Calendar provider {provider} is currently unavailable",
                sync_context={"service": "calendar", "provider": provider}
            )

        # Return cached client if available
        with self._client_lock:
            if provider in self._clients:
                return self._clients[provider]

            # Create new client instance
            try:
                if provider == "google":
                    client = GoogleCalendarClient(self._google_settings)
                    self._clients[provider] = client
                    logger.info(f"Successfully created new {provider} calendar client")
                    return client
            except Exception as e:
                self._handle_provider_error(provider)
                raise IntegrationSyncError(
                    message=f"Failed to initialize {provider} calendar client: {str(e)}",
                    sync_context={"service": "calendar", "provider": provider}
                )

    def register_provider(self, provider: str, client_class: Type) -> None:
        """
        Register a new calendar provider with security validation.

        Args:
            provider: Provider name
            client_class: Provider client class implementation
        """
        if not provider or not isinstance(provider, str):
            raise ValueError("Provider name must be a non-empty string")

        if not client_class:
            raise ValueError("Client class implementation is required")

        # Verify required interface methods
        required_methods = ["create_event", "update_event", "delete_event", "get_events"]
        if not all(hasattr(client_class, method) for method in required_methods):
            raise ValueError(f"Client class must implement methods: {required_methods}")

        with self._client_lock:
            if provider not in SUPPORTED_PROVIDERS:
                SUPPORTED_PROVIDERS.append(provider)
            
            # Initialize monitoring for new provider
            if provider not in self._metrics:
                self._metrics[provider] = CalendarMetrics()
            if provider not in self._health_status:
                self._health_status[provider] = ProviderHealth()

            logger.info(f"Successfully registered calendar provider: {provider}")

# Create thread-safe singleton instance
calendar_factory = CalendarFactory()