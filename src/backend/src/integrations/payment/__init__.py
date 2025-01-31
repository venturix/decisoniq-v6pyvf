"""
Payment integration initialization module for Customer Success AI Platform.
Provides thread-safe, performant, and secure Stripe payment processing capabilities
with comprehensive error handling, caching, and monitoring.

Dependencies:
- stripe==5.x
- tenacity==8.x
- redis==4.x
"""

import logging
import threading
from typing import Optional

from .stripe import StripeClient
from config.integrations import integration_settings

# Configure module logger
logger = logging.getLogger(__name__)

# Thread-safe singleton instance
_lock = threading.Lock()
stripe_client: Optional[StripeClient] = None

def get_stripe_client() -> StripeClient:
    """
    Thread-safe factory function that returns a singleton instance of the StripeClient
    with proper initialization, validation, and error handling.

    Returns:
        StripeClient: Initialized and cached Stripe client instance with rate limiting
                     and retry policies

    Raises:
        ValueError: If required Stripe configuration is missing
        ConnectionError: If Stripe client initialization fails
    """
    global stripe_client

    # Use double-checked locking pattern for thread safety
    if stripe_client is None:
        with _lock:
            # Check again to prevent race condition
            if stripe_client is None:
                try:
                    # Get Stripe integration configuration
                    config = integration_settings.get_integration_config('stripe')
                    if not config:
                        raise ValueError("Stripe integration configuration not found")

                    # Initialize Stripe client with rate limiting and retry policies
                    stripe_client = StripeClient(
                        api_key=config['settings'].api_key,
                        webhook_secret=config['settings'].webhook_secret,
                        cache_client=config.get('cache_client')
                    )

                    # Log successful initialization
                    logger.info(
                        "Stripe client initialized successfully",
                        extra={
                            "rate_limit": config['settings'].rate_limit,
                            "burst_limit": config['settings'].burst_limit,
                            "retry_policy": config['retry_policy']
                        }
                    )

                except Exception as e:
                    logger.error(f"Failed to initialize Stripe client: {str(e)}")
                    raise ConnectionError(f"Stripe client initialization failed: {str(e)}")

    return stripe_client

# Export Stripe client factory and core functionality
__all__ = [
    'get_stripe_client',
    'StripeClient'
]