"""
API package initialization module for Customer Success AI Platform.
Configures and exports the FastAPI application instance with enhanced security,
authentication, and performance monitoring middleware components.

Version: 1.0.0
Dependencies:
- fastapi==0.100+
- redis==7.x
"""

from api.server import create_application
from api.middleware import (
    AuthenticationMiddleware,
    TelemetryMiddleware,
    ErrorHandlerMiddleware
)
from core.telemetry import track_metric, MetricsTracker
from core.auth import BlitzyAuthManager
from core.cache import CacheManager
from config.security import SecuritySettings
from config.cache import CacheSettings

# Initialize security and cache settings
security_settings = SecuritySettings()
cache_settings = CacheSettings()

# Initialize cache manager
cache_manager = CacheManager(cache_settings)

# Initialize auth manager with Redis session store
auth_manager = BlitzyAuthManager(
    security_settings=security_settings,
    session_store=cache_manager._client,
    rate_limiter=None,  # Will be injected by middleware
    audit_logger=None   # Will be injected by middleware
)

# Initialize metrics tracker
metrics_tracker = MetricsTracker()

# Create FastAPI application instance with enhanced middleware stack
app = create_application(
    title='Customer Success AI Platform',
    version='1.0.0',
    debug=False,
    middleware=[
        # Authentication middleware with MFA and audit logging
        AuthenticationMiddleware(
            auth_manager=auth_manager,
            security_config=security_settings.get_jwt_settings()
        ),
        
        # Performance monitoring middleware with distributed tracing
        TelemetryMiddleware(
            metrics_tracker=metrics_tracker,
            sla_threshold_ms=3000  # 3s SLA requirement
        ),
        
        # Error handling middleware with retry logic
        ErrorHandlerMiddleware(
            retry_enabled=True,
            max_retries=3,
            error_tracking=True
        )
    ]
)

# Track application initialization
track_metric(
    'app.initialization',
    1,
    {
        'middleware_count': len(app.middleware),
        'auth_enabled': True,
        'telemetry_enabled': True
    }
)

# Export configured application and middleware components
__all__ = [
    'app',
    'AuthenticationMiddleware',
    'TelemetryMiddleware', 
    'ErrorHandlerMiddleware'
]