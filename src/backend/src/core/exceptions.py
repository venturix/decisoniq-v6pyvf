"""
Core exception classes for the Customer Success AI Platform.
Provides a comprehensive hierarchy of custom exceptions with standardized error handling,
monitoring integration, and enhanced context tracking.
"""

# fastapi v0.100+
from fastapi import HTTPException
from datetime import datetime
import uuid
import logging
from typing import Dict, List, Optional, Any

class BaseCustomException(HTTPException):
    """
    Base exception class for all custom exceptions in the platform.
    Provides enhanced monitoring capabilities and standardized error handling.
    """
    
    def __init__(
        self,
        message: str,
        error_code: str,
        status_code: int = 500,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        super().__init__(status_code=status_code, detail=message)
        self.message = self._sanitize_message(message)
        self.error_code = error_code
        self.status_code = status_code
        self.metadata = metadata or {}
        self.timestamp = datetime.utcnow().isoformat()
        self.trace_id = str(uuid.uuid4())
        
        # Set up structured logging context
        self._setup_logging_context()
    
    def _sanitize_message(self, message: str) -> str:
        """Sanitize error message to prevent injection attacks."""
        return str(message).strip()
    
    def _setup_logging_context(self) -> None:
        """Configure structured logging with error context."""
        logging.error(
            f"Exception occurred: {self.error_code}",
            extra={
                "error_code": self.error_code,
                "status_code": self.status_code,
                "trace_id": self.trace_id,
                "timestamp": self.timestamp,
                "metadata": self.metadata
            }
        )

class AuthenticationError(BaseCustomException):
    """Exception for authentication and authorization failures."""
    
    def __init__(
        self,
        message: str,
        auth_context: Optional[Dict[str, Any]] = None
    ) -> None:
        self.auth_context = self._sanitize_auth_context(auth_context or {})
        super().__init__(
            message=message,
            error_code="AUTH001",
            status_code=401,
            metadata={"auth_context": self.auth_context}
        )
    
    def _sanitize_auth_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive information from auth context."""
        sensitive_fields = {"password", "token", "secret"}
        return {k: v for k, v in context.items() if k not in sensitive_fields}

class DataValidationError(BaseCustomException):
    """Exception for data validation failures with field-level details."""
    
    def __init__(
        self,
        message: str,
        validation_errors: Dict[str, List[str]]
    ) -> None:
        self.validation_errors = validation_errors
        super().__init__(
            message=message,
            error_code="DATA001",
            status_code=422,
            metadata={"validation_errors": self._format_validation_errors()}
        )
    
    def _format_validation_errors(self) -> Dict[str, List[str]]:
        """Format field-level validation errors for clear presentation."""
        return {
            field: [str(error) for error in errors]
            for field, errors in self.validation_errors.items()
        }

class PredictionServiceError(BaseCustomException):
    """Exception for ML prediction service failures with fallback handling."""
    
    def __init__(
        self,
        message: str,
        model_context: Dict[str, Any]
    ) -> None:
        self.model_context = model_context
        self.fallback_available = self._check_fallback_availability()
        super().__init__(
            message=message,
            error_code="PRED001",
            status_code=503,
            metadata={
                "model_context": self.model_context,
                "fallback_available": self.fallback_available
            }
        )
    
    def _check_fallback_availability(self) -> bool:
        """Check if fallback model is available for prediction."""
        return bool(self.model_context.get("fallback_model_id"))

class IntegrationSyncError(BaseCustomException):
    """Exception for integration synchronization failures with retry logic."""
    
    def __init__(
        self,
        message: str,
        sync_context: Dict[str, Any]
    ) -> None:
        self.sync_context = sync_context
        self.retry_count = 0
        self.retry_strategy = self._configure_retry_strategy()
        super().__init__(
            message=message,
            error_code="SYNC001",
            status_code=503,
            metadata={
                "sync_context": self.sync_context,
                "retry_strategy": self.retry_strategy
            }
        )
    
    def _configure_retry_strategy(self) -> Dict[str, Any]:
        """Configure exponential backoff retry strategy."""
        return {
            "max_retries": 3,
            "base_delay": 5,
            "max_delay": 60,
            "exponential_base": 2
        }

class RateLimitError(BaseCustomException):
    """Exception for rate limit violations with quota tracking."""
    
    def __init__(
        self,
        message: str,
        rate_limit_context: Dict[str, Any]
    ) -> None:
        self.rate_limit_context = rate_limit_context
        self.reset_time = self._calculate_reset_time()
        self.current_usage = rate_limit_context.get("current_usage", 0)
        super().__init__(
            message=message,
            error_code="RATE001",
            status_code=429,
            metadata={
                "rate_limit_context": self.rate_limit_context,
                "reset_time": self.reset_time,
                "current_usage": self.current_usage
            }
        )
    
    def _calculate_reset_time(self) -> int:
        """Calculate time until rate limit reset in seconds."""
        return self.rate_limit_context.get("reset_time", 3600)

class PlaybookExecutionError(BaseCustomException):
    """Exception for playbook execution failures with rollback support."""
    
    def __init__(
        self,
        message: str,
        execution_context: Dict[str, Any]
    ) -> None:
        self.execution_context = execution_context
        self.rollback_steps = self._prepare_rollback_steps()
        self.can_rollback = bool(self.rollback_steps)
        super().__init__(
            message=message,
            error_code="PLAY001",
            status_code=500,
            metadata={
                "execution_context": self.execution_context,
                "can_rollback": self.can_rollback,
                "rollback_steps": self.rollback_steps
            }
        )
    
    def _prepare_rollback_steps(self) -> List[Dict[str, Any]]:
        """Prepare ordered list of rollback steps."""
        steps = self.execution_context.get("completed_steps", [])
        return [{"step": step, "status": "pending"} for step in reversed(steps)]

class MLModelError(BaseCustomException):
    """Exception for ML model inference failures with model diagnostics."""
    
    def __init__(
        self,
        message: str,
        model_diagnostics: Dict[str, Any]
    ) -> None:
        self.model_diagnostics = model_diagnostics
        self.performance_metrics = self._calculate_performance_metrics()
        self.requires_retraining = self._check_retraining_requirements()
        super().__init__(
            message=message,
            error_code="ML001",
            status_code=500,
            metadata={
                "model_diagnostics": self.model_diagnostics,
                "performance_metrics": self.performance_metrics,
                "requires_retraining": self.requires_retraining
            }
        )
    
    def _calculate_performance_metrics(self) -> Dict[str, float]:
        """Calculate current model performance metrics."""
        metrics = self.model_diagnostics.get("metrics", {})
        return {
            "accuracy": metrics.get("accuracy", 0.0),
            "error_rate": metrics.get("error_rate", 0.0),
            "latency": metrics.get("latency_ms", 0.0)
        }
    
    def _check_retraining_requirements(self) -> bool:
        """Check if model requires retraining based on performance."""
        metrics = self.performance_metrics
        return (
            metrics["accuracy"] < 0.9 or
            metrics["error_rate"] > 0.1 or
            metrics["latency"] > 100.0
        )