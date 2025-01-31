"""
Core logging implementation for the Customer Success AI Platform.
Provides enterprise-grade logging with structured JSON output, security features,
and Datadog APM integration.

Dependencies:
- logging==3.11+
- python-json-logger==2.0.7
- datadog==0.44.0
"""

import logging
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from logging.handlers import RotatingFileHandler
from pythonjsonlogger import jsonlogger  # python-json-logger v2.0.7
from datadog.logger import DatadogLogHandler  # datadog v0.44.0
from config.logging import LoggingSettings

# Global logger instance
logger = logging.getLogger(__name__)

# Constants for log file rotation
MAX_LOG_SIZE = 10 * 1024 * 1024  # 10MB
BACKUP_COUNT = 5

class StructuredLogger:
    """Enhanced logger with structured logging, security features, and performance tracking."""

    def __init__(self, name: str):
        """Initialize structured logger with context management and security features."""
        self._logger = logging.getLogger(name)
        self._context = {}
        self._security_context = {}
        self._trace_id = str(uuid.uuid4())

    def set_context(self, context: Dict[str, Any]) -> None:
        """Set context data for structured logging with security validation."""
        # Sanitize sensitive information
        sanitized_context = self._sanitize_context(context)
        
        # Update contexts
        self._context.update(sanitized_context)
        self._security_context.update({
            'trace_id': self._trace_id,
            'timestamp': datetime.utcnow().isoformat(),
            'logger_name': self._logger.name
        })

    def log(self, level: str, message: str, extra: Optional[Dict[str, Any]] = None) -> None:
        """Log message with structured context, security audit, and performance tracking."""
        if extra is None:
            extra = {}

        # Combine all context data
        log_data = {
            **self._context,
            **self._security_context,
            **extra,
            'message': message,
            'level': level,
            'timestamp': datetime.utcnow().isoformat(),
            'trace_id': self._trace_id
        }

        # Add performance metrics if available
        if 'duration_ms' in extra:
            log_data['performance'] = {
                'duration_ms': extra['duration_ms'],
                'threshold_exceeded': extra.get('duration_ms', 0) > 1000
            }

        # Log with appropriate level
        log_method = getattr(self._logger, level.lower(), self._logger.info)
        log_method(message, extra=log_data)

    def _sanitize_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize sensitive information from context data."""
        sensitive_fields = {'password', 'token', 'api_key', 'secret'}
        sanitized = {}
        
        for key, value in context.items():
            if key.lower() in sensitive_fields:
                sanitized[key] = '***REDACTED***'
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_context(value)
            else:
                sanitized[key] = value
                
        return sanitized

def setup_logging(settings: LoggingSettings) -> logging.Logger:
    """Initialize comprehensive logging system with security and monitoring features."""
    # Get logging configuration
    config = settings.get_log_config()
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(config['loggers']['']['level'])

    # JSON formatter for structured logging
    json_formatter = jsonlogger.JsonFormatter(
        fmt='%(timestamp)s %(level)s %(name)s %(trace_id)s %(message)s',
        json_ensure_ascii=False,
        timestamp=True
    )

    # Console handler with color formatting
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(json_formatter)
    root_logger.addHandler(console_handler)

    # Rotating file handler
    file_handler = RotatingFileHandler(
        filename=config['handlers']['file']['filename'],
        maxBytes=MAX_LOG_SIZE,
        backupCount=BACKUP_COUNT
    )
    file_handler.setFormatter(json_formatter)
    root_logger.addHandler(file_handler)

    # Configure Datadog handler for production
    if config['handlers'].get('datadog'):
        datadog_handler = DatadogLogHandler(
            api_key=config['handlers']['datadog']['api_key'],
            tags=config['handlers']['datadog']['tags']
        )
        datadog_handler.setFormatter(json_formatter)
        root_logger.addHandler(datadog_handler)

    # Configure audit logging
    audit_handler = RotatingFileHandler(
        filename=config['handlers']['audit']['filename'],
        maxBytes=MAX_LOG_SIZE,
        backupCount=config['handlers']['audit']['backupCount']
    )
    audit_handler.setFormatter(json_formatter)
    audit_logger = logging.getLogger('audit')
    audit_logger.addHandler(audit_handler)
    audit_logger.setLevel(logging.INFO)

    return root_logger

def get_logger(module_name: str) -> StructuredLogger:
    """Returns a configured logger instance for the specified module."""
    return StructuredLogger(module_name)