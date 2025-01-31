"""
Main entry point for Celery worker tasks in the Customer Success AI Platform.
Provides enhanced task registration, monitoring, circuit breaker patterns,
and comprehensive error handling for distributed task processing.

Dependencies:
- structlog==23.1.0
- celery==5.3.0
- prometheus_client==0.17.0
- circuitbreaker==1.4.0
"""

import structlog
from celery import Task
from prometheus_client import Counter, Histogram
from circuitbreaker import circuit

# Import task modules
from .notifications import (
    send_single_notification,
    send_bulk_notifications,
    process_notification_event
)
from .integrations import (
    sync_crm_customer,
    schedule_calendar_event,
    process_payment_webhook,
    bulk_crm_sync
)
from .ml import (
    process_customer_features,
    train_ml_model,
    generate_predictions,
    monitor_model_performance
)
from .playbooks import (
    execute_playbook_task,
    check_execution_status_task,
    cleanup_completed_executions_task
)

# Configure structured logging
logger = structlog.get_logger(__name__)

# Configure circuit breaker settings
CIRCUIT_BREAKER_THRESHOLD = 5
RETRY_BACKOFF = 60
MAX_RETRIES = 3

# Initialize Prometheus metrics
TASK_EXECUTION_TIME = Histogram(
    'task_execution_seconds',
    'Task execution time in seconds',
    ['task_name']
)
TASK_FAILURES = Counter(
    'task_failures_total',
    'Number of task failures',
    ['task_name', 'error_type']
)
CIRCUIT_BREAKER_TRIPS = Counter(
    'circuit_breaker_trips_total',
    'Number of circuit breaker trips',
    ['task_name']
)

class BaseTask(Task):
    """Enhanced base task class with monitoring and circuit breaker patterns."""

    abstract = True

    def __call__(self, *args, **kwargs):
        """Execute task with enhanced monitoring and error handling."""
        with TASK_EXECUTION_TIME.labels(task_name=self.name).time():
            try:
                return super().__call__(*args, **kwargs)
            except Exception as e:
                TASK_FAILURES.labels(
                    task_name=self.name,
                    error_type=type(e).__name__
                ).inc()
                raise

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Enhanced failure handling with structured logging."""
        logger.error(
            "task_failed",
            task_name=self.name,
            task_id=task_id,
            error=str(exc),
            args=args,
            kwargs=kwargs
        )
        super().on_failure(exc, task_id, args, kwargs, einfo)

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Enhanced retry handling with backoff."""
        logger.warning(
            "task_retrying",
            task_name=self.name,
            task_id=task_id,
            retry_count=self.request.retries,
            args=args,
            kwargs=kwargs
        )
        super().on_retry(exc, task_id, args, kwargs, einfo)

    def apply_circuit_breaker(self, threshold: int = CIRCUIT_BREAKER_THRESHOLD):
        """Apply circuit breaker pattern to task."""
        def decorator(func):
            @circuit(
                failure_threshold=threshold,
                recovery_timeout=RETRY_BACKOFF,
                name=f"circuit_breaker_{self.name}"
            )
            def wrapper(*args, **kwargs):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    CIRCUIT_BREAKER_TRIPS.labels(task_name=self.name).inc()
                    raise
            return wrapper
        return decorator

# Export notification tasks
__all__ = [
    # Notification tasks
    'send_single_notification',
    'send_bulk_notifications',
    'process_notification_event',
    
    # Integration tasks
    'sync_crm_customer',
    'schedule_calendar_event',
    'process_payment_webhook',
    'bulk_crm_sync',
    
    # ML tasks
    'process_customer_features',
    'train_ml_model',
    'generate_predictions',
    'monitor_model_performance',
    
    # Playbook tasks
    'execute_playbook_task',
    'check_execution_status_task',
    'cleanup_completed_executions_task'
]

# Apply base task class and circuit breakers to all tasks
for task_name in __all__:
    task = globals()[task_name]
    if isinstance(task, Task):
        task.base = BaseTask
        task = task.apply_circuit_breaker()(task)