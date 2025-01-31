"""
Core telemetry module for the Customer Success AI Platform.
Provides enterprise-grade metrics collection, SLA monitoring, and performance tracking
with Datadog APM integration and comprehensive observability features.

Dependencies:
- datadog==0.44.0
"""

import time
import functools
from typing import Dict, Any, Optional, Callable
import datadog
from config.settings import env, debug
from core.logging import StructuredLogger

# Initialize module logger
logger = StructuredLogger(__name__)

# Constants
METRIC_PREFIX = "cs_platform"
PREDICTION_SLA_THRESHOLD = 3.0  # 3 seconds for predictions
INTERVENTION_METRICS_ENABLED = True

class MetricsTracker:
    """Enhanced context manager for tracking operation metrics with SLA monitoring."""

    def __init__(
        self, 
        operation_name: str, 
        tags: Optional[Dict[str, str]] = None,
        track_sla: bool = False
    ) -> None:
        """Initialize metrics tracker with enhanced monitoring capabilities."""
        self._operation_name = operation_name
        self._tags = tags or {}
        self._start_time = None
        self._track_sla = track_sla
        self._context = {
            'operation': operation_name,
            'environment': env,
            'tags': self._tags
        }
        
        # Add default tags
        self._tags.update({
            'env': env,
            'service': 'cs_platform',
            'operation': operation_name
        })

    def __enter__(self) -> 'MetricsTracker':
        """Begin metrics tracking with performance monitoring."""
        self._start_time = time.perf_counter()
        
        # Log operation start
        logger.log('info', f"Starting operation: {self._operation_name}", 
                  extra={'context': self._context})
        
        # Initialize operation metrics
        datadog.statsd.increment(
            f"{METRIC_PREFIX}.operation.start",
            tags=[f"{k}:{v}" for k, v in self._tags.items()]
        )
        
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Complete metrics tracking with SLA verification."""
        duration = (time.perf_counter() - self._start_time) * 1000  # Convert to ms
        
        # Track operation duration
        datadog.statsd.histogram(
            f"{METRIC_PREFIX}.operation.duration",
            duration,
            tags=[f"{k}:{v}" for k, v in self._tags.items()]
        )
        
        # Check SLA compliance if enabled
        if self._track_sla:
            sla_threshold = (
                PREDICTION_SLA_THRESHOLD * 1000  # Convert to ms
                if 'prediction' in self._operation_name 
                else float('inf')
            )
            
            if duration > sla_threshold:
                datadog.statsd.increment(
                    f"{METRIC_PREFIX}.sla.violation",
                    tags=[f"{k}:{v}" for k, v in self._tags.items()]
                )
                logger.log('warning', 
                          f"SLA violation: {self._operation_name} took {duration}ms",
                          extra={'duration_ms': duration, 'threshold_ms': sla_threshold})
        
        # Track operation status
        status_metric = f"{METRIC_PREFIX}.operation.{'error' if exc_type else 'success'}"
        datadog.statsd.increment(
            status_metric,
            tags=[f"{k}:{v}" for k, v in self._tags.items()]
        )
        
        # Log completion
        logger.log(
            'error' if exc_type else 'info',
            f"Completed operation: {self._operation_name}",
            extra={
                'duration_ms': duration,
                'status': 'error' if exc_type else 'success',
                'context': self._context
            }
        )

def initialize_telemetry() -> None:
    """Initialize enhanced telemetry system with comprehensive monitoring."""
    try:
        # Initialize Datadog client
        datadog.initialize(
            statsd_host='localhost',
            statsd_port=8125,
            statsd_constant_tags=[
                f"env:{env}",
                "service:cs_platform",
                "version:1.0"
            ]
        )
        
        # Configure metric aggregation
        datadog.statsd.constant_tags = [
            f"env:{env}",
            "service:cs_platform"
        ]
        
        # Set up performance monitoring
        if not debug:
            datadog.statsd.gauge(
                f"{METRIC_PREFIX}.system.initialized",
                1,
                tags=["status:active"]
            )
        
        logger.log('info', "Telemetry system initialized successfully")
        
    except Exception as e:
        logger.log('error', f"Failed to initialize telemetry: {str(e)}")
        raise

def track_metric(
    metric_name: str,
    value: float,
    tags: Optional[Dict[str, str]] = None,
    metric_type: str = "gauge"
) -> bool:
    """Record metrics with enhanced validation and context."""
    try:
        # Validate and format metric name
        if not metric_name.startswith(METRIC_PREFIX):
            metric_name = f"{METRIC_PREFIX}.{metric_name}"
        
        # Prepare tags
        formatted_tags = [f"{k}:{v}" for k, v in (tags or {}).items()]
        formatted_tags.extend([f"env:{env}", "service:cs_platform"])
        
        # Record metric based on type
        if metric_type == "gauge":
            datadog.statsd.gauge(metric_name, value, tags=formatted_tags)
        elif metric_type == "counter":
            datadog.statsd.increment(metric_name, value, tags=formatted_tags)
        elif metric_type == "histogram":
            datadog.statsd.histogram(metric_name, value, tags=formatted_tags)
        
        logger.log('debug', f"Recorded metric: {metric_name}",
                  extra={'value': value, 'tags': tags, 'type': metric_type})
        return True
        
    except Exception as e:
        logger.log('error', f"Failed to record metric {metric_name}: {str(e)}")
        return False

def track_timing(metric_name: str, sla_monitoring: bool = False) -> Callable:
    """Enhanced decorator for execution timing with SLA monitoring."""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            with MetricsTracker(
                operation_name=metric_name,
                track_sla=sla_monitoring
            ) as tracker:
                try:
                    result = func(*args, **kwargs)
                    return result
                except Exception as e:
                    # Track exception metrics
                    datadog.statsd.increment(
                        f"{METRIC_PREFIX}.error",
                        tags=[
                            f"function:{func.__name__}",
                            f"error_type:{type(e).__name__}",
                            f"env:{env}"
                        ]
                    )
                    raise
        return wrapper
    return decorator