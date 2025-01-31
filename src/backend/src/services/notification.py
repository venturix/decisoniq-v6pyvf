"""
Core notification service for managing and delivering notifications across multiple channels.
Provides enterprise-grade features including comprehensive error handling, rate limiting,
circuit breakers, and telemetry.

Dependencies:
- pydantic==2.x
- sendgrid==6.x
- jinja2==3.x
- redis==4.x
- circuit-breaker-pattern==1.x
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, validator
from sendgrid import SendGridAPIClient
from jinja2 import Environment, select_autoescape
from redis import Redis
from circuit_breaker_pattern import circuit_breaker

from core.events import Event, emit_event
from core.telemetry import track_metric, track_timing
from core.exceptions import BaseCustomException

# Global constants
NOTIFICATION_TYPES = {'email', 'in_app', 'webhook', 'sms'}
PRIORITY_LEVELS = {'high': 1, 'medium': 2, 'low': 3}
MAX_RETRIES = 3
RATE_LIMIT_WINDOW = 3600  # 1 hour
CIRCUIT_BREAKER_THRESHOLD = 0.5
BATCH_SIZE = 100

class NotificationError(BaseCustomException):
    """Custom exception for notification-related errors."""
    def __init__(self, message: str, channel: str, metadata: Optional[Dict] = None):
        error_code = f"NOTIFICATION_{channel.upper()}_ERROR"
        super().__init__(message=message, error_code=error_code, metadata=metadata)

class NotificationSchema(BaseModel):
    """Validation schema for notification data."""
    type: str
    recipient: str
    subject: Optional[str]
    content: Dict[str, Any]
    priority: str = 'medium'
    template_id: Optional[str]
    metadata: Optional[Dict[str, Any]]

    @validator('type')
    def validate_type(cls, v):
        if v not in NOTIFICATION_TYPES:
            raise ValueError(f"Invalid notification type. Must be one of {NOTIFICATION_TYPES}")
        return v

    @validator('priority')
    def validate_priority(cls, v):
        if v not in PRIORITY_LEVELS:
            raise ValueError(f"Invalid priority level. Must be one of {PRIORITY_LEVELS.keys()}")
        return v

class NotificationChannel:
    """Enhanced base class for notification channels with resilience."""
    
    def __init__(self, channel_type: str, config: Dict[str, Any]):
        self.channel_type = channel_type
        self.config = config
        self.breaker = self._init_circuit_breaker()
        self._init_metrics()

    def _init_circuit_breaker(self):
        return circuit_breaker(
            failure_threshold=CIRCUIT_BREAKER_THRESHOLD,
            recovery_timeout=30,
            name=f"notification_{self.channel_type}"
        )

    def _init_metrics(self):
        track_metric(
            f"notification.channel.initialized",
            1,
            tags={"channel": self.channel_type}
        )

    @track_timing("notification.send")
    async def send(self, notification: Dict[str, Any]) -> Dict[str, Any]:
        """Sends notification with advanced error handling."""
        try:
            # Check circuit breaker
            if not self.breaker.is_closed():
                raise NotificationError(
                    f"Circuit breaker open for {self.channel_type}",
                    self.channel_type
                )

            # Format notification
            formatted_content = self._format_content(notification)
            
            # Execute delivery
            result = await self._execute_delivery(formatted_content)
            
            # Track success
            track_metric(
                "notification.delivery.success",
                1,
                tags={"channel": self.channel_type}
            )

            return {
                "status": "delivered",
                "channel": self.channel_type,
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": result
            }

        except Exception as e:
            # Track failure
            track_metric(
                "notification.delivery.failure",
                1,
                tags={
                    "channel": self.channel_type,
                    "error": type(e).__name__
                }
            )
            raise NotificationError(
                str(e),
                self.channel_type,
                metadata={"notification": notification}
            )

    async def _execute_delivery(self, content: Dict[str, Any]) -> Dict[str, Any]:
        """Template method for channel-specific delivery logic."""
        raise NotImplementedError

    def _format_content(self, notification: Dict[str, Any]) -> Dict[str, Any]:
        """Format notification content for delivery."""
        raise NotImplementedError

class NotificationService:
    """Enterprise-grade notification service with comprehensive features."""

    def __init__(self, config: Dict[str, Any]):
        self._config = config
        self._channels: Dict[str, NotificationChannel] = {}
        self._templates = self._init_templates()
        self._rate_limiter = Redis(
            host=config.get("redis_host", "localhost"),
            port=config.get("redis_port", 6379)
        )
        self._init_channels()

    def _init_templates(self) -> Environment:
        """Initialize Jinja2 template environment with security features."""
        return Environment(
            autoescape=select_autoescape(['html', 'xml']),
            trim_blocks=True,
            lstrip_blocks=True
        )

    def _init_channels(self):
        """Initialize notification channels based on configuration."""
        for channel_type, channel_config in self._config.get("channels", {}).items():
            if channel_type in NOTIFICATION_TYPES:
                self._channels[channel_type] = NotificationChannel(
                    channel_type,
                    channel_config
                )

    @track_timing("notification.send", sla_monitoring=True)
    async def send_notification(
        self,
        notification_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Sends notification with comprehensive error handling."""
        try:
            # Validate notification data
            notification = NotificationSchema(**notification_data)

            # Check rate limits
            if not self._check_rate_limit(notification.recipient):
                raise NotificationError(
                    "Rate limit exceeded",
                    notification.type,
                    metadata={"recipient": notification.recipient}
                )

            # Select channel
            channel = self._channels.get(notification.type)
            if not channel:
                raise NotificationError(
                    f"Channel not configured: {notification.type}",
                    notification.type
                )

            # Send notification
            result = await channel.send(notification_data)

            # Emit event
            await emit_event(
                "notification.sent",
                {
                    "notification_id": result.get("id"),
                    "channel": notification.type,
                    "recipient": notification.recipient,
                    "status": "delivered"
                }
            )

            return result

        except Exception as e:
            # Track failure
            track_metric(
                "notification.send.failure",
                1,
                tags={"error": type(e).__name__}
            )
            raise

    @track_timing("notification.send_bulk")
    async def send_bulk_notifications(
        self,
        notifications: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Send multiple notifications in batches with error handling."""
        results = []
        
        # Process in batches
        for i in range(0, len(notifications), BATCH_SIZE):
            batch = notifications[i:i + BATCH_SIZE]
            
            # Send notifications concurrently
            tasks = [
                self.send_notification(notification)
                for notification in batch
            ]
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            results.extend(batch_results)

        return results

    def _check_rate_limit(self, recipient: str) -> bool:
        """Check rate limits for recipient."""
        key = f"rate_limit:{recipient}"
        count = self._rate_limiter.get(key)
        
        if count is None:
            self._rate_limiter.setex(
                key,
                RATE_LIMIT_WINDOW,
                1
            )
            return True
            
        count = int(count)
        if count >= self._config.get("rate_limit", 100):
            return False
            
        self._rate_limiter.incr(key)
        return True