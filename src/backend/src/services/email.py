"""
Enterprise-grade email service module for Customer Success AI Platform.
Handles secure email delivery, template management, and comprehensive monitoring.

Dependencies:
- sendgrid==6.9.7
- pydantic==2.x
- jinja2==3.1.2
- aiosmtplib==2.0.1
"""

import os
from typing import Dict, Any, List, Optional
from datetime import datetime
import asyncio
from functools import wraps

from sendgrid import SendGridAPIClient  # sendgrid v6.9.7
from pydantic import BaseModel, Field, EmailStr, validator
from jinja2 import Environment, FileSystemLoader, select_autoescape
from aiosmtplib import SMTP  # aiosmtplib v2.0.1

from config.settings import env, debug
from core.logging import get_logger

# Constants for email service configuration
MAX_RETRIES = 3
RETRY_DELAY = 5
TEMPLATE_DIR = 'templates/email'
MAX_BATCH_SIZE = 1000
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024  # 10MB
RATE_LIMIT_WINDOW = 3600  # 1 hour
RATE_LIMIT_MAX = 100000  # Maximum emails per hour

class EmailPayload(BaseModel):
    """Enhanced email payload model with comprehensive validation."""
    
    recipient_email: EmailStr
    subject: str = Field(..., min_length=1, max_length=998)  # RFC 5322
    body: str = Field(..., min_length=1)
    template_data: Dict[str, Any] = Field(default_factory=dict)
    template_name: Optional[str] = None
    attachments: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    track_opens: bool = True
    track_clicks: bool = True
    categories: List[str] = Field(default_factory=list)
    custom_args: Dict[str, str] = Field(default_factory=dict)

    @validator('attachments')
    def validate_attachments(cls, v):
        """Validate attachment size and content type."""
        for attachment in v:
            if len(attachment.get('content', '')) > MAX_ATTACHMENT_SIZE:
                raise ValueError(f'Attachment size exceeds maximum of {MAX_ATTACHMENT_SIZE} bytes')
            if not attachment.get('type', '').startswith(('text/', 'application/')):
                raise ValueError('Invalid attachment content type')
        return v

    @validator('template_name')
    def validate_template(cls, v):
        """Validate template existence and permissions."""
        if v and not os.path.exists(os.path.join(TEMPLATE_DIR, f'{v}.html')):
            raise ValueError(f'Template {v} not found')
        return v

def retry_with_exponential_backoff(func):
    """Decorator for exponential backoff retry strategy."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        for attempt in range(MAX_RETRIES):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                if attempt == MAX_RETRIES - 1:
                    raise
                delay = RETRY_DELAY * (2 ** attempt)
                await asyncio.sleep(delay)
        return await func(*args, **kwargs)
    return wrapper

class EmailService:
    """Enterprise-grade email service with comprehensive features."""

    def __init__(self):
        """Initialize email service with enhanced security and monitoring."""
        self._logger = get_logger(__name__)
        self._sendgrid_client = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        self._jinja_env = Environment(
            loader=FileSystemLoader(TEMPLATE_DIR),
            autoescape=select_autoescape(['html', 'xml']),
            enable_async=True
        )
        self._template_cache = {}
        self._fallback_smtp = SMTP(
            hostname=os.getenv('SMTP_HOST'),
            port=int(os.getenv('SMTP_PORT', 587)),
            use_tls=True
        )
        self._setup_monitoring()

    def _setup_monitoring(self):
        """Configure comprehensive monitoring and metrics collection."""
        self._metrics = {
            'sent_count': 0,
            'error_count': 0,
            'retry_count': 0,
            'template_cache_hits': 0,
            'delivery_times': []
        }

    @retry_with_exponential_backoff
    async def send_email(self, payload: EmailPayload) -> Dict[str, Any]:
        """Send a single email with comprehensive tracking and security."""
        start_time = datetime.utcnow()
        
        try:
            # Prepare email data with security headers
            email_data = {
                'personalizations': [{
                    'to': [{'email': payload.recipient_email}],
                    'subject': payload.subject,
                    'custom_args': payload.custom_args
                }],
                'content': [{'type': 'text/html', 'value': payload.body}],
                'from': {'email': os.getenv('SENDER_EMAIL')},
                'tracking_settings': {
                    'click_tracking': {'enable': payload.track_clicks},
                    'open_tracking': {'enable': payload.track_opens}
                },
                'categories': payload.categories,
                'custom_args': {
                    'env': env,
                    'trace_id': payload.metadata.get('trace_id', '')
                }
            }

            # Add attachments if present
            if payload.attachments:
                email_data['attachments'] = payload.attachments

            # Attempt SendGrid delivery
            response = await self._sendgrid_client.send(email_data)
            
            if response.status_code not in (200, 202):
                raise Exception(f"SendGrid delivery failed: {response.body}")

            # Track metrics
            delivery_time = (datetime.utcnow() - start_time).total_seconds()
            self._update_metrics(delivery_time)

            return {
                'status': 'delivered',
                'message_id': response.headers.get('X-Message-ID'),
                'delivery_time': delivery_time,
                'provider': 'sendgrid'
            }

        except Exception as e:
            self._logger.error(f"Email delivery failed: {str(e)}", extra={
                'recipient': payload.recipient_email,
                'error': str(e)
            })
            
            # Attempt fallback delivery
            return await self._fallback_delivery(payload)

    async def send_template_email(
        self,
        template_name: str,
        recipient_email: str,
        template_data: Dict[str, Any],
        subject: str
    ) -> Dict[str, Any]:
        """Send templated email with caching and security features."""
        try:
            # Get template from cache or load it
            if template_name in self._template_cache:
                template = self._template_cache[template_name]
                self._metrics['template_cache_hits'] += 1
            else:
                template = self._jinja_env.get_template(f"{template_name}.html")
                self._template_cache[template_name] = template

            # Render template with security context
            rendered_content = await template.render_async(
                **template_data,
                env=env,
                timestamp=datetime.utcnow().isoformat()
            )

            # Create and send email
            payload = EmailPayload(
                recipient_email=recipient_email,
                subject=subject,
                body=rendered_content,
                template_name=template_name,
                template_data=template_data,
                metadata={'template_used': template_name}
            )

            return await self.send_email(payload)

        except Exception as e:
            self._logger.error(f"Template email failed: {str(e)}", extra={
                'template': template_name,
                'recipient': recipient_email,
                'error': str(e)
            })
            raise

    async def send_bulk_emails(self, payloads: List[EmailPayload]) -> Dict[str, Dict[str, Any]]:
        """Send bulk emails with batching and comprehensive status tracking."""
        results = {}
        
        # Process in batches
        for i in range(0, len(payloads), MAX_BATCH_SIZE):
            batch = payloads[i:i + MAX_BATCH_SIZE]
            batch_results = await asyncio.gather(
                *[self.send_email(payload) for payload in batch],
                return_exceptions=True
            )
            
            # Collect results
            for payload, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    results[payload.recipient_email] = {
                        'status': 'failed',
                        'error': str(result)
                    }
                else:
                    results[payload.recipient_email] = result

        return results

    async def _fallback_delivery(self, payload: EmailPayload) -> Dict[str, Any]:
        """Attempt fallback delivery using SMTP with security measures."""
        try:
            await self._fallback_smtp.connect()
            await self._fallback_smtp.starttls()
            await self._fallback_smtp.login(
                os.getenv('SMTP_USERNAME'),
                os.getenv('SMTP_PASSWORD')
            )

            # Send email via SMTP
            await self._fallback_smtp.send_message(
                subject=payload.subject,
                sender=os.getenv('SENDER_EMAIL'),
                recipients=[payload.recipient_email],
                html=payload.body
            )

            return {
                'status': 'delivered',
                'provider': 'smtp_fallback',
                'timestamp': datetime.utcnow().isoformat()
            }

        except Exception as e:
            self._logger.error(f"Fallback delivery failed: {str(e)}")
            raise
        finally:
            await self._fallback_smtp.quit()

    def _update_metrics(self, delivery_time: float):
        """Update service metrics with thread safety."""
        self._metrics['sent_count'] += 1
        self._metrics['delivery_times'].append(delivery_time)
        
        # Maintain rolling window of delivery times
        if len(self._metrics['delivery_times']) > 1000:
            self._metrics['delivery_times'] = self._metrics['delivery_times'][-1000:]