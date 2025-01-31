"""
Blitzy platform integrations initialization module for Customer Success AI Platform.
Provides centralized configuration, initialization, and lifecycle management of
Blitzy Enterprise SSO and Blitzy Tables services with comprehensive monitoring.

Version: 2.0.0
Dependencies:
- blitzy-sdk==2.x
- tenacity==8.2.0
- asyncio==3.11+
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from .auth import BlitzyEnterpriseSSO
from .tables import BlitzyTablesClient
from core.exceptions import IntegrationSyncError
from core.logging import get_logger

# Initialize structured logger
logger = get_logger(__name__)

# Integration constants
BLITZY_INTEGRATION_VERSION = '2.0.0'
BLITZY_REQUIRED_SERVICES = ['sso', 'tables']
HEALTH_CHECK_INTERVAL = 60  # seconds
MAX_RETRY_ATTEMPTS = 3

class BlitzyIntegrationManager:
    """
    Manages all Blitzy platform integrations with comprehensive lifecycle management,
    health monitoring, and error recovery capabilities.
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        """
        Initialize Blitzy integration manager with configuration and monitoring setup.

        Args:
            config: Configuration dictionary containing SSO and Tables settings
        """
        self._config = self._validate_config(config)
        self._sso_client: Optional[BlitzyEnterpriseSSO] = None
        self._tables_client: Optional[BlitzyTablesClient] = None
        self._integration_status = {
            'sso': {'healthy': False, 'last_check': None},
            'tables': {'healthy': False, 'last_check': None}
        }
        self._health_metrics = {
            'response_times': [],
            'error_counts': {'sso': 0, 'tables': 0},
            'uptime': 0.0
        }
        self._health_monitor_task: Optional[asyncio.Task] = None

        logger.info(
            "BlitzyIntegrationManager initialized",
            extra={'version': BLITZY_INTEGRATION_VERSION}
        )

    def _validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate integration configuration completeness."""
        required_fields = {
            'sso': ['client_id', 'client_secret', 'domain'],
            'tables': ['host', 'port', 'credentials']
        }

        for service, fields in required_fields.items():
            if service not in config:
                raise ValueError(f"Missing configuration for {service}")
            for field in fields:
                if field not in config[service]:
                    raise ValueError(f"Missing {field} in {service} configuration")

        return config

    @retry(
        stop=stop_after_attempt(MAX_RETRY_ATTEMPTS),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(IntegrationSyncError)
    )
    async def start_services(self) -> bool:
        """
        Starts all required Blitzy services with health verification.

        Returns:
            bool: True if all services started successfully
        """
        try:
            # Initialize SSO service
            self._sso_client = BlitzyEnterpriseSSO()
            await self._sso_client.initialize_sso(self._config['sso'])
            
            # Verify SSO connection
            if not await self._sso_client.verify_connection():
                raise IntegrationSyncError(
                    message="Failed to verify SSO connection",
                    sync_context={'service': 'sso'}
                )

            # Initialize Tables service
            self._tables_client = BlitzyTablesClient(self._config['tables'])
            await self._tables_client.initialize()
            
            # Start health monitoring
            self._health_monitor_task = asyncio.create_task(self.monitor_health())
            
            logger.info(
                "Blitzy services started successfully",
                extra={'services': BLITZY_REQUIRED_SERVICES}
            )
            return True

        except Exception as e:
            logger.error(
                "Failed to start Blitzy services",
                extra={'error': str(e)}
            )
            raise

    async def stop_services(self) -> bool:
        """
        Gracefully stops all Blitzy services with proper cleanup.

        Returns:
            bool: True if all services stopped successfully
        """
        try:
            # Stop health monitoring
            if self._health_monitor_task:
                self._health_monitor_task.cancel()
                await asyncio.gather(self._health_monitor_task, return_exceptions=True)

            # Shutdown Tables service
            if self._tables_client:
                await self._tables_client.graceful_shutdown()

            # Shutdown SSO service
            if self._sso_client:
                await self._sso_client.shutdown()

            logger.info("Blitzy services stopped successfully")
            return True

        except Exception as e:
            logger.error(
                "Error stopping Blitzy services",
                extra={'error': str(e)}
            )
            return False

    async def monitor_health(self) -> None:
        """Continuously monitors health of all integration services."""
        while True:
            try:
                # Check SSO health
                if self._sso_client:
                    sso_health = await self._sso_client.verify_connection()
                    self._integration_status['sso'].update({
                        'healthy': sso_health,
                        'last_check': asyncio.get_event_loop().time()
                    })

                # Check Tables health
                if self._tables_client:
                    tables_health = await self._tables_client.check_health()
                    self._integration_status['tables'].update({
                        'healthy': tables_health,
                        'last_check': asyncio.get_event_loop().time()
                    })

                # Update metrics
                self._update_health_metrics()

                # Log health status
                logger.info(
                    "Integration health check completed",
                    extra={
                        'status': self._integration_status,
                        'metrics': self._health_metrics
                    }
                )

                await asyncio.sleep(HEALTH_CHECK_INTERVAL)

            except Exception as e:
                logger.error(
                    "Health check failed",
                    extra={'error': str(e)}
                )
                await asyncio.sleep(HEALTH_CHECK_INTERVAL)

    def _update_health_metrics(self) -> None:
        """Update integration health metrics."""
        for service in BLITZY_REQUIRED_SERVICES:
            if not self._integration_status[service]['healthy']:
                self._health_metrics['error_counts'][service] += 1

        # Calculate uptime percentage
        total_checks = sum(self._health_metrics['error_counts'].values())
        if total_checks > 0:
            self._health_metrics['uptime'] = (
                1 - sum(self._health_metrics['error_counts'].values()) / total_checks
            ) * 100

@retry(
    stop=stop_after_attempt(MAX_RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(IntegrationSyncError)
)
async def initialize_blitzy_integrations(config_dict: Dict[str, Any]) -> bool:
    """
    Initializes all required Blitzy platform integrations with retry logic.

    Args:
        config_dict: Configuration dictionary for all Blitzy services

    Returns:
        bool: True if initialization successful
    """
    try:
        manager = BlitzyIntegrationManager(config_dict)
        return await manager.start_services()
    except Exception as e:
        logger.error(
            "Failed to initialize Blitzy integrations",
            extra={'error': str(e)}
        )
        raise

async def verify_integration_status() -> Dict[str, Any]:
    """
    Performs comprehensive health check of all Blitzy integrations.

    Returns:
        Dict containing detailed status of each integration service
    """
    try:
        sso_client = BlitzyEnterpriseSSO()
        tables_client = BlitzyTablesClient({})

        status = {
            'sso': {
                'connected': await sso_client.verify_connection(),
                'latency_ms': 0,
                'error_rate': 0
            },
            'tables': {
                'connected': await tables_client.check_health(),
                'latency_ms': 0,
                'error_rate': 0
            }
        }

        return status

    except Exception as e:
        logger.error(
            "Integration status check failed",
            extra={'error': str(e)}
        )
        raise