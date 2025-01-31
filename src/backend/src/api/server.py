"""
Main FastAPI application server module for Customer Success AI Platform.
Provides enterprise-grade API server with comprehensive security, monitoring,
and performance optimizations for sub-3s response times.

Version: 1.0.0
Dependencies:
- fastapi==0.100+
- uvicorn==0.22+
- redis==7.x
"""

import logging
from typing import Dict, Any
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry import trace

from config.settings import get_api_prefix, get_app_settings
from api.middleware import (
    AuthenticationMiddleware,
    TelemetryMiddleware,
    RateLimitMiddleware
)
from api.routes.health import router as health_router
from core.telemetry import track_metric, MetricsTracker
from core.exceptions import BaseCustomException

# Configure logging
logger = logging.getLogger(__name__)

# Initialize tracer
tracer = trace.get_tracer(__name__)

@tracer.start_as_current_span('create_application')
def create_application() -> FastAPI:
    """
    Creates and configures FastAPI application with enhanced security and monitoring.
    
    Returns:
        FastAPI: Configured application instance
    """
    # Get application settings
    settings = get_app_settings()
    
    # Initialize FastAPI with custom documentation URLs
    app = FastAPI(
        title=settings['project_name'],
        version=settings['api_version'],
        docs_url=f"{get_api_prefix()}/docs",
        redoc_url=f"{get_api_prefix()}/redoc",
        openapi_url=f"{get_api_prefix()}/openapi.json"
    )

    # Configure middleware
    configure_middleware(app)

    # Configure routers
    configure_routers(app)

    # Configure exception handlers
    @app.exception_handler(BaseCustomException)
    async def custom_exception_handler(request: Request, exc: BaseCustomException):
        """Enhanced exception handler with monitoring."""
        logger.error(
            f"Request failed: {exc.message}",
            extra={
                "path": request.url.path,
                "method": request.method,
                "error_code": exc.error_code,
                "trace_id": request.state.trace_id
            }
        )
        
        # Track error metrics
        track_metric(
            'api.error',
            1,
            {
                "path": request.url.path,
                "method": request.method,
                "error_code": exc.error_code
            }
        )
        
        return {
            "status": "error",
            "message": exc.message,
            "error_code": exc.error_code,
            "trace_id": request.state.trace_id
        }

    # Configure startup and shutdown events
    @app.on_event("startup")
    async def startup_event():
        """Initialize services on startup."""
        logger.info("Starting application")
        track_metric('app.startup', 1)

    @app.on_event("shutdown")
    async def shutdown_event():
        """Cleanup on shutdown."""
        logger.info("Shutting down application")
        track_metric('app.shutdown', 1)

    return app

@tracer.start_as_current_span('configure_middleware')
def configure_middleware(app: FastAPI) -> None:
    """
    Configures all middleware components with security and monitoring.
    
    Args:
        app: FastAPI application instance
    """
    # Get application settings
    settings = get_app_settings()

    # Configure CORS with strict security policies
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get('allowed_origins', []),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Request-ID",
            "X-API-Key"
        ],
        expose_headers=["X-Request-ID"],
        max_age=3600
    )

    # Add authentication middleware with MFA support
    app.add_middleware(AuthenticationMiddleware)

    # Add telemetry middleware for distributed tracing
    app.add_middleware(TelemetryMiddleware)

    # Add rate limiting middleware with Redis backend
    app.add_middleware(RateLimitMiddleware)

    # Add security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        """Add security headers to all responses."""
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

@tracer.start_as_current_span('configure_routers')
def configure_routers(app: FastAPI) -> None:
    """
    Registers all API routers with proper prefixes.
    
    Args:
        app: FastAPI application instance
    """
    # Get API prefix
    prefix = get_api_prefix()

    # Include routers
    app.include_router(
        health_router,
        prefix=f"{prefix}/health",
        tags=["Health"]
    )
    # Additional routers would be included here

@tracer.start_as_current_span('start_application')
def start_application() -> None:
    """
    Starts the FastAPI application with optimized server settings.
    """
    # Create application
    app = create_application()

    # Configure Uvicorn with performance optimizations
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=8000,
        workers=4,
        loop="uvloop",
        http="httptools",
        log_level="info",
        proxy_headers=True,
        forwarded_allow_ips="*",
        timeout_keep_alive=30,
        access_log=True
    )

    server = uvicorn.Server(config)
    server.run()

# Create application instance for ASGI servers
app = create_application()

if __name__ == "__main__":
    start_application()