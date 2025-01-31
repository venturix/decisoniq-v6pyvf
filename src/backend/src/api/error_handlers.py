"""
FastAPI exception handlers and error handling utilities for the Customer Success AI Platform API.
Provides standardized error responses and logging with security audit and performance tracking.

Dependencies:
- fastapi==0.100+
- python-json-logger==2.0.7
- datadog==0.44.0
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from datetime import datetime
from typing import Dict, Any, Optional

from core.exceptions import (
    BaseCustomException,
    AuthenticationError,
    DataValidationError,
    PredictionServiceError
)
from core.logging import get_logger

# Initialize structured logger
logger = get_logger(__name__)

def register_exception_handlers(app: FastAPI) -> None:
    """
    Registers all exception handlers with the FastAPI application.
    Configures comprehensive error handling with security audit logging.
    """
    # Register handlers for custom exceptions
    app.exception_handler(BaseCustomException)(handle_custom_exception)
    app.exception_handler(HTTPException)(handle_http_exception)
    app.exception_handler(RequestValidationError)(handle_validation_error)
    app.exception_handler(Exception)(handle_generic_exception)

    # Log handler registration
    logger.log(
        "info",
        "Exception handlers registered",
        extra={
            "handlers": [
                "BaseCustomException",
                "HTTPException",
                "RequestValidationError",
                "Exception"
            ],
            "timestamp": datetime.utcnow().isoformat()
        }
    )

async def handle_custom_exception(
    request: Request,
    exc: BaseCustomException
) -> JSONResponse:
    """
    Handles custom application exceptions with enhanced error context and security logging.
    
    Args:
        request: FastAPI request object
        exc: Custom exception instance
    
    Returns:
        JSONResponse with standardized error format
    """
    # Extract trace ID from request state
    trace_id = getattr(request.state, "trace_id", str(request.state.trace_id))
    
    # Enhanced error context
    error_context = {
        "error_code": exc.error_code,
        "path": request.url.path,
        "method": request.method,
        "trace_id": trace_id,
        "timestamp": datetime.utcnow().isoformat(),
        **exc.metadata
    }

    # Security audit logging
    logger.log(
        "error",
        f"Custom exception occurred: {exc.message}",
        extra={
            "error_context": error_context,
            "security_context": {
                "user_id": getattr(request.state, "user_id", None),
                "ip_address": request.client.host,
                "user_agent": request.headers.get("user-agent")
            }
        }
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.message,
            "error_code": exc.error_code,
            "trace_id": trace_id,
            "metadata": exc.metadata
        }
    )

async def handle_http_exception(
    request: Request,
    exc: HTTPException
) -> JSONResponse:
    """
    Handles HTTP exceptions with trace correlation and monitoring.
    
    Args:
        request: FastAPI request object
        exc: HTTP exception instance
    
    Returns:
        JSONResponse with error details
    """
    trace_id = getattr(request.state, "trace_id", str(request.state.trace_id))
    
    # Log HTTP exception with trace correlation
    logger.log(
        "error",
        f"HTTP exception occurred: {exc.detail}",
        extra={
            "status_code": exc.status_code,
            "path": request.url.path,
            "method": request.method,
            "trace_id": trace_id,
            "headers": dict(exc.headers) if exc.headers else {}
        }
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
            "trace_id": trace_id
        },
        headers=exc.headers
    )

async def handle_validation_error(
    request: Request,
    exc: RequestValidationError
) -> JSONResponse:
    """
    Handles request validation errors with detailed field validation context.
    
    Args:
        request: FastAPI request object
        exc: Validation error instance
    
    Returns:
        JSONResponse with validation details
    """
    trace_id = getattr(request.state, "trace_id", str(request.state.trace_id))
    
    # Format validation errors
    validation_errors = {}
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        validation_errors[field] = error["msg"]

    # Log validation error with field context
    logger.log(
        "warning",
        "Request validation failed",
        extra={
            "validation_errors": validation_errors,
            "path": request.url.path,
            "method": request.method,
            "trace_id": trace_id,
            "body": await request.body()
        }
    )

    return JSONResponse(
        status_code=422,
        content={
            "error": True,
            "message": "Request validation failed",
            "validation_errors": validation_errors,
            "trace_id": trace_id
        }
    )

async def handle_generic_exception(
    request: Request,
    exc: Exception
) -> JSONResponse:
    """
    Handles unexpected exceptions with enhanced logging and monitoring.
    
    Args:
        request: FastAPI request object
        exc: Generic exception instance
    
    Returns:
        JSONResponse with generic error response
    """
    trace_id = getattr(request.state, "trace_id", str(request.state.trace_id))
    
    # Log unexpected exception with full context
    logger.log(
        "error",
        f"Unexpected error occurred: {str(exc)}",
        extra={
            "exception_type": exc.__class__.__name__,
            "trace_id": trace_id,
            "path": request.url.path,
            "method": request.method,
            "headers": dict(request.headers),
            "query_params": dict(request.query_params),
            "timestamp": datetime.utcnow().isoformat()
        }
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": "An unexpected error occurred",
            "trace_id": trace_id
        }
    )