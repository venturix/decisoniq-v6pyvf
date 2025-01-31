"""
Enterprise-grade logging configuration for the Customer Success AI Platform backend.
Provides secure audit logging, performance monitoring, and Datadog APM integration
with comprehensive observability features.

Dependencies:
- logging==3.11+
- python-json-logger==2.0.7
- datadog==0.44.0
"""

import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional
from pythonjsonlogger import jsonlogger  # python-json-logger v2.0.7
import datadog  # datadog v0.44.0
from config.settings import env, debug

# Default log format with trace ID for distributed tracing
DEFAULT_LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(trace_id)s - %(message)s"

# JSON log format for structured logging
JSON_LOG_FORMAT = "%(timestamp)s %(level)s %(name)s %(trace_id)s %(message)s %(context)s"

# Environment-specific log levels
LOG_LEVELS = {
    "development": "DEBUG",
    "staging": "INFO",
    "production": "WARNING"
}

# Fields to mask in logs for security
SENSITIVE_FIELDS = [
    "password",
    "token", 
    "api_key",
    "secret",
    "credit_card"
]

# Log retention policies in days
LOG_RETENTION = {
    "audit": 365,  # SOC2 compliance requirement
    "error": 90,
    "info": 30,
    "debug": 7
}

class LoggingSettings:
    """Comprehensive logging configuration manager with security, performance, and monitoring features."""
    
    def __init__(self) -> None:
        """Initializes logging settings with environment-specific configuration and security features."""
        self.level = LOG_LEVELS.get(env, "INFO")
        self.format = JSON_LOG_FORMAT if env == "production" else DEFAULT_LOG_FORMAT
        self.log_file_path = f"logs/csai-platform-{env}.log"
        self.json_output = env == "production"
        self.datadog_enabled = env == "production"
        self.security_config = {
            "audit_enabled": True,
            "mask_sensitive_data": True,
            "compliance_tracking": True
        }
        self.retention_policy = LOG_RETENTION
        self.masked_fields = SENSITIVE_FIELDS
        self.datadog_config = {
            "api_key": None,  # Set via environment variable
            "app_key": None,  # Set via environment variable
            "service_name": "cs-ai-platform",
            "env": env,
            "trace_sample_rate": 1.0 if debug else 0.1
        }

    def get_log_config(self) -> Dict[str, Any]:
        """Generates comprehensive logging configuration with security and monitoring."""
        config = {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {
                    "()": jsonlogger.JsonFormatter,
                    "format": self.format,
                    "timestamp": True
                },
                "standard": {
                    "format": self.format
                }
            },
            "filters": {
                "sensitive_data": {
                    "()": "config.logging.SensitiveDataFilter",
                    "masked_fields": self.masked_fields
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "json" if self.json_output else "standard",
                    "filters": ["sensitive_data"],
                    "level": self.level
                },
                "file": {
                    "class": "logging.handlers.RotatingFileHandler",
                    "filename": self.log_file_path,
                    "formatter": "json" if self.json_output else "standard",
                    "filters": ["sensitive_data"],
                    "maxBytes": 10485760,  # 10MB
                    "backupCount": 10,
                    "level": self.level
                },
                "audit": {
                    "class": "logging.handlers.TimedRotatingFileHandler",
                    "filename": f"logs/audit/csai-platform-audit-{env}.log",
                    "formatter": "json",
                    "filters": ["sensitive_data"],
                    "when": "midnight",
                    "interval": 1,
                    "backupCount": self.retention_policy["audit"],
                    "level": "INFO"
                }
            },
            "loggers": {
                "": {  # Root logger
                    "handlers": ["console", "file"],
                    "level": self.level,
                    "propagate": True
                },
                "audit": {
                    "handlers": ["audit"],
                    "level": "INFO",
                    "propagate": False
                },
                "datadog": {
                    "handlers": ["console"],
                    "level": "WARNING",
                    "propagate": False
                }
            }
        }

        if self.datadog_enabled:
            self._configure_datadog_logging(config)

        return config

    def configure_security_audit(self) -> Dict[str, Any]:
        """Configures security audit logging settings."""
        return {
            "audit_log_path": f"logs/audit/csai-platform-audit-{env}.log",
            "retention_days": self.retention_policy["audit"],
            "mask_fields": self.masked_fields,
            "compliance": {
                "soc2": True,
                "gdpr": True,
                "iso27001": True
            },
            "alert_triggers": {
                "unauthorized_access": True,
                "configuration_change": True,
                "security_event": True
            }
        }

    def setup_datadog_apm(self) -> Dict[str, Any]:
        """Configures Datadog APM and distributed tracing."""
        if not self.datadog_enabled:
            return {}

        datadog.initialize(
            api_key=self.datadog_config["api_key"],
            app_key=self.datadog_config["app_key"],
            host_name=f"csai-platform-{env}"
        )

        return {
            "service_name": self.datadog_config["service_name"],
            "env": self.datadog_config["env"],
            "trace_sample_rate": self.datadog_config["trace_sample_rate"],
            "analytics_enabled": True,
            "distributed_tracing": True,
            "profiling_enabled": env == "production",
            "log_injection_enabled": True
        }

    def _configure_datadog_logging(self, config: Dict[str, Any]) -> None:
        """Configures Datadog logging integration."""
        config["handlers"]["datadog"] = {
            "class": "datadog.handlers.DatadogHandler",
            "formatter": "json",
            "filters": ["sensitive_data"],
            "level": self.level,
            "api_key": self.datadog_config["api_key"],
            "tags": [
                f"env:{env}",
                f"service:{self.datadog_config['service_name']}"
            ]
        }
        config["loggers"][""]["handlers"].append("datadog")

class SensitiveDataFilter(logging.Filter):
    """Filter for masking sensitive data in log records."""

    def __init__(self, masked_fields: list) -> None:
        """Initialize filter with fields to mask."""
        super().__init__()
        self.masked_fields = masked_fields

    def filter(self, record: logging.LogRecord) -> bool:
        """Masks sensitive data in log records."""
        if isinstance(record.msg, dict):
            record.msg = self._mask_sensitive_data(record.msg)
        elif isinstance(record.args, dict):
            record.args = self._mask_sensitive_data(record.args)
        return True

    def _mask_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively masks sensitive data in dictionaries."""
        masked_data = data.copy()
        for key, value in data.items():
            if key.lower() in self.masked_fields:
                masked_data[key] = "***MASKED***"
            elif isinstance(value, dict):
                masked_data[key] = self._mask_sensitive_data(value)
        return masked_data

def configure_logging(settings: LoggingSettings) -> None:
    """Initializes enterprise logging configuration with security and monitoring."""
    config = settings.get_log_config()
    logging.config.dictConfig(config)

    # Configure security audit logging
    audit_config = settings.configure_security_audit()
    logging.getLogger("audit").info(
        "Logging system initialized",
        extra={
            "audit_config": audit_config,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

    # Initialize Datadog APM if enabled
    if settings.datadog_enabled:
        apm_config = settings.setup_datadog_apm()
        logging.info(
            "Datadog APM initialized",
            extra={
                "apm_config": apm_config,
                "timestamp": datetime.utcnow().isoformat()
            }
        )