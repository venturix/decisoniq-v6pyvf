"""
FastAPI middleware components for request/response processing, authentication, telemetry,
and error handling in the Customer Success AI Platform with enhanced security,
monitoring and performance features.

Version: 1.0.0
"""

import logging
import time
from typing import Dict, Optional, Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
import redis  # v7.x

from core.auth import BlitzyAuthManager
from core.telemetry import track_metric, MetricsTracker
from core.exceptions import AuthenticationError, RateLimitError

# Configure logging
logger = logging.getLogger(__name__)

# Rate limiting constants
RATE_LIMIT_REQUESTS = 1000  # Requests per window
RATE_LIMIT_WINDOW = 3600   # Window in seconds
BURST_MULTIPLIER = 1.5     # Burst allowance multiplier
SLA_THRESHOLD_MS = 200     # Response time SLA in milliseconds

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """Enhanced middleware for authenticating API requests using Blitzy Enterprise SSO with MFA support."""

    def __init__(self, auth_manager: BlitzyAuthManager, security_config: Dict):
        """Initialize enhanced authentication middleware.
        
        Args:
            auth_manager: BlitzyAuthManager instance for authentication
            security_config: Security configuration settings
        """
        super().__init__()
        self.auth_manager = auth_manager
        self.security_config = security_config
        
        # Initialize security audit logging
        self.audit_logger = logging.getLogger('audit')

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with enhanced authentication.
        
        Args:
            request: FastAPI request object
            call_next: Next middleware in chain
            
        Returns:
            Response: API response
            
        Raises:
            AuthenticationError: If authentication fails
        """
        try:
            # Extract authorization header
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                raise AuthenticationError(
                    message="Missing authorization header",
                    auth_context={"path": request.url.path}
                )

            # Verify token
            token = auth_header.split(' ')[1]
            user_data = self.auth_manager.verify_token(token)

            # Verify MFA if required
            if self.security_config.get('mfa_required'):
                mfa_code = request.headers.get('X-MFA-Code')
                if not self.auth_manager.verify_mfa(str(user_data['id']), mfa_code):
                    raise AuthenticationError(
                        message="Invalid MFA code",
                        auth_context={"user_id": user_data['id']}
                    )

            # Validate permissions
            if not self.auth_manager.validate_permissions(
                user_data['roles'],
                request.url.path,
                request.method
            ):
                raise AuthenticationError(
                    message="Insufficient permissions",
                    auth_context={
                        "user_id": user_data['id'],
                        "roles": user_data['roles'],
                        "path": request.url.path
                    }
                )

            # Add user context to request state
            request.state.user = user_data
            
            # Log security audit event
            self.audit_logger.info(
                "Authentication successful",
                extra={
                    "user_id": user_data['id'],
                    "path": request.url.path,
                    "method": request.method,
                    "ip_address": request.client.host
                }
            )

            # Process request
            response = await call_next(request)

            # Add security headers
            response.headers['X-Content-Type-Options'] = 'nosniff'
            response.headers['X-Frame-Options'] = 'DENY'
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

            return response

        except AuthenticationError as e:
            logger.error(f"Authentication failed: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in authentication: {str(e)}")
            raise AuthenticationError(
                message="Authentication failed",
                auth_context={"error": str(e)}
            )

class TelemetryMiddleware(BaseHTTPMiddleware):
    """Enhanced middleware for collecting comprehensive request metrics and performance data."""

    def __init__(self, metrics_tracker: MetricsTracker):
        """Initialize enhanced telemetry middleware.
        
        Args:
            metrics_tracker: MetricsTracker instance for metrics collection
        """
        super().__init__()
        self.metrics_tracker = metrics_tracker

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with enhanced monitoring.
        
        Args:
            request: FastAPI request object
            call_next: Next middleware in chain
            
        Returns:
            Response: API response
        """
        # Start distributed trace
        trace_id = request.headers.get('X-Request-ID', str(time.time()))
        self.metrics_tracker.record_trace(trace_id)

        # Record request start time
        start_time = time.perf_counter()

        try:
            # Process request
            response = await call_next(request)

            # Calculate request duration
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Track SLA compliance
            self.metrics_tracker.track_sla(
                path=request.url.path,
                method=request.method,
                duration_ms=duration_ms,
                threshold_ms=SLA_THRESHOLD_MS
            )

            # Record metrics
            track_metric(
                'request.duration',
                duration_ms,
                {
                    'path': request.url.path,
                    'method': request.method,
                    'status_code': response.status_code
                }
            )

            # Add timing headers
            response.headers['X-Response-Time'] = f"{duration_ms:.2f}ms"
            response.headers['X-Trace-ID'] = trace_id

            return response

        except Exception as e:
            logger.error(f"Request processing failed: {str(e)}")
            # Track error metrics
            track_metric(
                'request.error',
                1,
                {
                    'path': request.url.path,
                    'method': request.method,
                    'error': str(e)
                }
            )
            raise

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enhanced middleware for enforcing adaptive API rate limits with burst handling."""

    def __init__(self, redis_client: redis.Redis, rate_config: Dict):
        """Initialize enhanced rate limit middleware.
        
        Args:
            redis_client: Redis client for rate limiting
            rate_config: Rate limiting configuration
        """
        super().__init__()
        self.redis_client = redis_client
        self.rate_config = rate_config

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with enhanced rate limiting.
        
        Args:
            request: FastAPI request object
            call_next: Next middleware in chain
            
        Returns:
            Response: API response
            
        Raises:
            RateLimitError: If rate limit is exceeded
        """
        try:
            # Extract client identifier
            client_id = request.headers.get('X-API-Key') or request.client.host

            # Check IP allowlist/blocklist
            if self._is_ip_blocked(request.client.host):
                raise RateLimitError(
                    message="IP address blocked",
                    rate_limit_context={"ip": request.client.host}
                )

            # Calculate rate limit window
            window = int(time.time() / RATE_LIMIT_WINDOW) * RATE_LIMIT_WINDOW
            key = f"rate_limit:{client_id}:{window}"

            # Check current request count
            current_requests = int(self.redis_client.get(key) or 0)

            # Calculate burst allowance
            burst_limit = int(RATE_LIMIT_REQUESTS * BURST_MULTIPLIER)

            if current_requests >= burst_limit:
                raise RateLimitError(
                    message="Rate limit exceeded",
                    rate_limit_context={
                        "current": current_requests,
                        "limit": RATE_LIMIT_REQUESTS,
                        "window": RATE_LIMIT_WINDOW
                    }
                )

            # Increment request counter
            pipe = self.redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, RATE_LIMIT_WINDOW)
            pipe.execute()

            # Process request
            response = await call_next(request)

            # Add rate limit headers
            remaining = burst_limit - current_requests - 1
            response.headers['X-RateLimit-Limit'] = str(RATE_LIMIT_REQUESTS)
            response.headers['X-RateLimit-Remaining'] = str(max(0, remaining))
            response.headers['X-RateLimit-Reset'] = str(window + RATE_LIMIT_WINDOW)

            return response

        except RateLimitError:
            raise
        except Exception as e:
            logger.error(f"Rate limiting failed: {str(e)}")
            raise RateLimitError(
                message="Rate limiting error",
                rate_limit_context={"error": str(e)}
            )

    def _is_ip_blocked(self, ip_address: str) -> bool:
        """Check if IP address is blocked.
        
        Args:
            ip_address: IP address to check
            
        Returns:
            bool: True if IP is blocked
        """
        blocked_ips = self.rate_config.get('blocked_ips', set())
        return ip_address in blocked_ips