"""
Stripe payment integration module for Customer Success AI Platform.
Handles billing operations and revenue tracking with advanced rate limiting,
retry handling, and expansion revenue monitoring.

Dependencies:
- stripe==5.x
- tenacity==8.x
- pydantic==2.x
- redis==4.x
"""

import logging
from decimal import Decimal
from typing import Dict, Optional
import stripe
import redis
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
from pydantic import BaseModel, ValidationError

from ...config.integrations import get_integration_config
from ...models.customer import Customer

# Constants
DEFAULT_CURRENCY = 'USD'
STRIPE_API_VERSION = '2023-10-16'
RATE_LIMIT_KEY = 'stripe_rate_limit'
CACHE_TTL = 3600  # 1 hour cache TTL

# Configure logging
logger = logging.getLogger(__name__)

class StripeClient:
    """Enhanced Stripe API client with rate limiting, retry handling, and revenue tracking."""

    def __init__(
        self,
        api_key: str,
        webhook_secret: str,
        cache_client: Optional[redis.Redis] = None
    ) -> None:
        """
        Initialize Stripe client with enhanced configuration.

        Args:
            api_key: Stripe API key
            webhook_secret: Webhook signing secret
            cache_client: Optional Redis client for caching
        """
        self._api_key = api_key
        self._webhook_secret = webhook_secret
        
        # Configure Stripe client
        stripe.api_key = api_key
        stripe.api_version = STRIPE_API_VERSION
        self._client = stripe

        # Get integration settings
        config = get_integration_config('stripe')
        self._rate_limit = config['settings'].rate_limit
        self._burst_limit = config['settings'].burst_limit

        # Initialize Redis cache
        self._cache = cache_client
        
        # Initialize metrics tracking
        self._metrics = {
            'api_calls': 0,
            'cache_hits': 0,
            'retry_count': 0,
            'revenue_changes': []
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(stripe.error.APIError)
    )
    def get_customer_subscription(self, customer_id: str) -> Dict:
        """
        Retrieves customer subscription details with caching and rate limiting.

        Args:
            customer_id: Stripe customer ID

        Returns:
            Dict containing subscription details including MRR and status
        """
        # Check cache first
        cache_key = f"stripe_sub_{customer_id}"
        if self._cache:
            cached_data = self._cache.get(cache_key)
            if cached_data:
                self._metrics['cache_hits'] += 1
                return cached_data

        # Check rate limit
        if not self._check_rate_limit():
            raise stripe.error.RateLimitError("Rate limit exceeded")

        try:
            # Retrieve subscription data
            subscription = self._client.Subscription.list(
                customer=customer_id,
                limit=1,
                status='active'
            ).data[0]

            # Process subscription data
            subscription_data = {
                'id': subscription.id,
                'status': subscription.status,
                'current_period_end': subscription.current_period_end,
                'mrr': Decimal(str(subscription.items.data[0].price.unit_amount / 100)),
                'currency': subscription.currency.upper(),
                'metadata': subscription.metadata
            }

            # Cache the result
            if self._cache:
                self._cache.setex(
                    cache_key,
                    CACHE_TTL,
                    subscription_data
                )

            # Update metrics
            self._metrics['api_calls'] += 1
            
            return subscription_data

        except stripe.error.StripeError as e:
            logger.error(f"Stripe API error: {str(e)}")
            raise

    def track_revenue_changes(
        self,
        customer: Customer,
        subscription_update: Dict
    ) -> Dict:
        """
        Enhanced tracking of revenue changes with expansion metrics.

        Args:
            customer: Customer model instance
            subscription_update: Updated subscription data

        Returns:
            Dict containing detailed revenue change metrics
        """
        previous_mrr = customer.mrr
        new_mrr = Decimal(str(subscription_update['mrr']))
        
        # Calculate revenue changes
        mrr_delta = new_mrr - previous_mrr
        percentage_change = (mrr_delta / previous_mrr * 100) if previous_mrr > 0 else 0

        # Categorize change
        change_type = 'expansion' if mrr_delta > 0 else 'contraction'
        
        # Create change record
        change_record = {
            'customer_id': str(customer.id),
            'previous_mrr': str(previous_mrr),
            'new_mrr': str(new_mrr),
            'delta': str(mrr_delta),
            'percentage': float(percentage_change),
            'type': change_type,
            'currency': subscription_update.get('currency', DEFAULT_CURRENCY)
        }

        # Update customer data
        customer.mrr = new_mrr
        customer.metadata.update({
            'last_mrr_change': change_record,
            'expansion_history': customer.metadata.get('expansion_history', []) + [change_record]
        })

        # Log revenue change
        logger.info(
            f"Revenue change detected for customer {customer.id}",
            extra={'change_record': change_record}
        )

        # Update metrics
        self._metrics['revenue_changes'].append(change_record)

        return change_record

    def handle_webhook(self, payload: str, signature: str) -> Dict:
        """
        Process Stripe webhooks with enhanced error handling and event processing.

        Args:
            payload: Webhook event payload
            signature: Webhook signature header

        Returns:
            Dict containing processed webhook event data
        """
        try:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload, signature, self._webhook_secret
            )

            # Process different event types
            if event.type.startswith('customer.subscription'):
                subscription = event.data.object
                
                # Extract customer data
                customer_id = subscription.customer
                subscription_data = {
                    'id': subscription.id,
                    'status': subscription.status,
                    'mrr': Decimal(str(subscription.items.data[0].price.unit_amount / 100)),
                    'currency': subscription.currency.upper()
                }

                # Handle subscription updates
                if event.type == 'customer.subscription.updated':
                    # Process revenue changes if applicable
                    customer = Customer.query.filter_by(
                        stripe_customer_id=customer_id
                    ).first()
                    if customer:
                        self.track_revenue_changes(customer, subscription_data)

            return {
                'event_id': event.id,
                'type': event.type,
                'processed': True,
                'timestamp': event.created
            }

        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Webhook processing error: {str(e)}")
            raise

    def _check_rate_limit(self) -> bool:
        """
        Check if current request is within rate limits.

        Returns:
            bool indicating if request can proceed
        """
        if not self._cache:
            return True

        current = int(self._cache.get(RATE_LIMIT_KEY) or 0)
        
        if current >= self._rate_limit:
            return False
        
        # Increment counter
        self._cache.incr(RATE_LIMIT_KEY)
        self._cache.expire(RATE_LIMIT_KEY, 3600)  # Reset after 1 hour
        
        return True