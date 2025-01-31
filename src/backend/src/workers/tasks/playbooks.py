"""
Celery worker tasks for executing and managing customer success playbooks.
Provides asynchronous execution, monitoring, and metrics tracking for automated interventions.

Version: Python 3.11+
Dependencies:
- celery==5.3.x
- structlog==23.1.0
- datadog==1.6.0
"""

import time
import uuid
from typing import Dict, Optional
import structlog
import datadog
from celery.exceptions import MaxRetriesExceededError, SoftTimeLimitExceeded

from workers.celery import celery_app
from services.playbook import PlaybookService
from models.playbook import Playbook

# Configure structured logging
logger = structlog.get_logger(__name__)

# Configure Datadog metrics
datadog.initialize()
statsd = datadog.statsd

# Constants for execution control
EXECUTION_TIMEOUT = 3600  # 1 hour timeout
MAX_RETRIES = 3
CIRCUIT_BREAKER_THRESHOLD = 5
METRICS_NAMESPACE = "customer_success.playbooks"

def track_execution_metrics(func):
    """Decorator for tracking execution metrics and performance."""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        task_id = str(uuid.uuid4())
        
        logger.info(
            "Starting playbook execution",
            task_id=task_id,
            args=args,
            kwargs=kwargs
        )
        
        try:
            result = func(*args, **kwargs)
            duration = (time.time() - start_time) * 1000
            
            # Track execution metrics
            statsd.timing(
                f"{METRICS_NAMESPACE}.execution_time",
                duration,
                tags=[f"task_id:{task_id}"]
            )
            statsd.increment(
                f"{METRICS_NAMESPACE}.executions_success",
                tags=[f"task_id:{task_id}"]
            )
            
            return result
            
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            
            # Track failure metrics
            statsd.timing(
                f"{METRICS_NAMESPACE}.execution_time",
                duration,
                tags=[f"task_id:{task_id}", "status:failed"]
            )
            statsd.increment(
                f"{METRICS_NAMESPACE}.executions_failed",
                tags=[f"task_id:{task_id}", f"error:{type(e).__name__}"]
            )
            
            raise
            
    return wrapper

@celery_app.task(
    queue="playbooks",
    bind=True,
    max_retries=MAX_RETRIES,
    time_limit=EXECUTION_TIMEOUT,
    soft_time_limit=EXECUTION_TIMEOUT - 60
)
@track_execution_metrics
def execute_playbook_async(
    self,
    playbook_id: uuid.UUID,
    customer_id: uuid.UUID,
    execution_context: Optional[Dict] = None
) -> uuid.UUID:
    """
    Asynchronously executes a playbook for a given customer with monitoring.
    
    Args:
        playbook_id: UUID of playbook to execute
        customer_id: UUID of target customer
        execution_context: Optional context data for execution
        
    Returns:
        UUID of execution instance for tracking
        
    Raises:
        MaxRetriesExceededError: When max retries are exhausted
        SoftTimeLimitExceeded: When execution timeout is reached
    """
    execution_context = execution_context or {}
    logger_ctx = logger.bind(
        playbook_id=str(playbook_id),
        customer_id=str(customer_id),
        task_id=self.request.id
    )
    
    try:
        logger_ctx.info("Starting playbook execution")
        
        # Initialize service with metrics tracking
        playbook_service = PlaybookService()
        
        # Check circuit breaker status
        error_count = statsd.get(
            f"{METRICS_NAMESPACE}.error_count",
            tags=[f"playbook_id:{playbook_id}"]
        ) or 0
        
        if error_count >= CIRCUIT_BREAKER_THRESHOLD:
            logger_ctx.error("Circuit breaker triggered - too many recent errors")
            raise ValueError("Circuit breaker open - execution blocked")
        
        # Execute playbook
        execution = playbook_service.execute_playbook(
            playbook_id=playbook_id,
            customer_id=customer_id,
            context=execution_context
        )
        
        # Track successful execution
        statsd.increment(
            f"{METRICS_NAMESPACE}.steps_completed",
            len(execution.results.get("completed_steps", [])),
            tags=[f"playbook_id:{playbook_id}"]
        )
        
        logger_ctx.info(
            "Playbook execution completed",
            execution_id=str(execution.id),
            steps_completed=len(execution.results.get("completed_steps", []))
        )
        
        return execution.id
        
    except SoftTimeLimitExceeded:
        logger_ctx.error("Execution timeout exceeded")
        statsd.increment(
            f"{METRICS_NAMESPACE}.timeouts",
            tags=[f"playbook_id:{playbook_id}"]
        )
        raise
        
    except Exception as e:
        logger_ctx.error(
            "Playbook execution failed",
            error=str(e),
            retry_count=self.request.retries
        )
        
        # Track failure metrics
        statsd.increment(
            f"{METRICS_NAMESPACE}.error_count",
            tags=[
                f"playbook_id:{playbook_id}",
                f"error_type:{type(e).__name__}"
            ]
        )
        
        # Retry with exponential backoff
        if self.request.retries < MAX_RETRIES:
            retry_delay = 2 ** self.request.retries * 60  # Exponential backoff
            raise self.retry(exc=e, countdown=retry_delay)
            
        raise MaxRetriesExceededError()

@celery_app.task(queue="playbooks")
@track_execution_metrics
def check_execution_status(execution_id: uuid.UUID) -> Dict:
    """
    Retrieves current status of a playbook execution with metrics.
    
    Args:
        execution_id: UUID of execution to check
        
    Returns:
        Dictionary containing execution status and metrics
    """
    logger_ctx = logger.bind(execution_id=str(execution_id))
    
    try:
        logger_ctx.info("Checking execution status")
        
        # Get execution status
        playbook_service = PlaybookService()
        execution = playbook_service.get_execution_status(execution_id)
        
        if not execution:
            logger_ctx.error("Execution not found")
            raise ValueError(f"Execution {execution_id} not found")
        
        # Track execution metrics
        if execution.status == "completed":
            success_rate = (
                len(execution.results.get("completed_steps", [])) /
                len(execution.results.get("total_steps", [1])) * 100
            )
            statsd.gauge(
                f"{METRICS_NAMESPACE}.success_rate",
                success_rate,
                tags=[f"execution_id:{execution_id}"]
            )
        
        logger_ctx.info(
            "Retrieved execution status",
            status=execution.status,
            metrics=execution.execution_metrics
        )
        
        return {
            "status": execution.status,
            "results": execution.results,
            "metrics": execution.execution_metrics,
            "error_logs": execution.error_logs
        }
        
    except Exception as e:
        logger_ctx.error("Failed to check execution status", error=str(e))
        statsd.increment(
            f"{METRICS_NAMESPACE}.status_check_errors",
            tags=[f"execution_id:{execution_id}"]
        )
        raise