"""
Task service module providing comprehensive business logic for customer success task management
with performance optimization, monitoring, and compliance tracking.

Dependencies:
- pydantic==2.x
- tenacity==8.x
- structlog==23.x
- redis==4.x
- opentelemetry==1.x
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union
from pydantic import BaseModel, validator
from tenacity import retry, stop_after_attempt, wait_exponential
from structlog import get_logger
from redis import Redis
from opentelemetry import trace

from models.task import Task, TaskStatus, TaskPriority, TaskType
from db.repositories.tasks import TaskRepository
from services.notification import NotificationService
from core.exceptions import BaseCustomException
from core.telemetry import track_metric, track_timing

# Initialize module components
logger = get_logger(__name__)
tracer = trace.get_tracer(__name__)

# Constants
TASK_COMPLETION_TIMEOUT = 24 * 60 * 60  # 24 hours in seconds
MAX_RETRY_ATTEMPTS = 3
CACHE_TTL = 300  # 5 minutes

class TaskCreationSchema(BaseModel):
    """Validation schema for task creation."""
    title: str
    description: str
    customer_id: uuid.UUID
    task_type: TaskType
    assignee_id: uuid.UUID
    priority: Optional[TaskPriority] = TaskPriority.medium
    due_date: Optional[datetime] = None
    metadata: Optional[Dict] = None

    @validator('title')
    def validate_title(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError("Title must be at least 3 characters long")
        return v.strip()

    @validator('description')
    def validate_description(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError("Description must be at least 10 characters long")
        return v.strip()

    @validator('due_date')
    def validate_due_date(cls, v):
        if v and v < datetime.utcnow():
            raise ValueError("Due date cannot be in the past")
        return v

class TaskService:
    """
    Comprehensive service class for managing customer success tasks with
    performance optimization, error handling, and monitoring capabilities.
    """

    def __init__(self, repository: TaskRepository, notification_service: NotificationService):
        """Initialize task service with required dependencies."""
        self._repository = repository
        self._notification_service = notification_service
        self._cache = Redis(host='localhost', port=6379, db=0)

    @track_timing("task.create", sla_monitoring=True)
    async def create_customer_task(
        self,
        title: str,
        description: str,
        customer_id: uuid.UUID,
        task_type: TaskType,
        assignee_id: uuid.UUID,
        priority: Optional[TaskPriority] = TaskPriority.medium,
        due_date: Optional[datetime] = None,
        metadata: Optional[Dict] = None
    ) -> Task:
        """
        Creates a new customer task with comprehensive validation and monitoring.

        Args:
            title: Task title
            description: Task description
            customer_id: Associated customer ID
            task_type: Type of task
            assignee_id: Assigned user ID
            priority: Task priority level
            due_date: Task due date
            metadata: Additional task metadata

        Returns:
            Task: Created task instance

        Raises:
            BaseCustomException: On validation or creation errors
        """
        try:
            # Validate input data
            task_data = TaskCreationSchema(
                title=title,
                description=description,
                customer_id=customer_id,
                task_type=task_type,
                assignee_id=assignee_id,
                priority=priority,
                due_date=due_date or datetime.utcnow() + timedelta(days=1),
                metadata=metadata or {}
            )

            # Create task with retry mechanism
            with tracer.start_as_current_span("create_task") as span:
                span.set_attribute("customer_id", str(customer_id))
                task = await self._create_task_with_retry(task_data)

            # Send notifications
            await self._notification_service.send_notification({
                "type": "task_created",
                "recipient": str(assignee_id),
                "subject": f"New Task Assigned: {title}",
                "content": {
                    "task_id": str(task.id),
                    "title": title,
                    "priority": priority.value
                }
            })

            # Track metrics
            track_metric(
                "task.created",
                1,
                tags={
                    "task_type": task_type.value,
                    "priority": priority.value,
                    "customer_id": str(customer_id)
                }
            )

            return task

        except Exception as e:
            logger.error(
                "Task creation failed",
                error=str(e),
                customer_id=str(customer_id),
                task_type=task_type.value
            )
            raise BaseCustomException(
                message=f"Failed to create task: {str(e)}",
                error_code="TASK001"
            )

    @track_timing("task.bulk_create", sla_monitoring=True)
    async def bulk_create_tasks(self, task_requests: List[Dict]) -> List[Task]:
        """
        Creates multiple tasks efficiently with batch processing.

        Args:
            task_requests: List of task creation parameters

        Returns:
            List[Task]: Created task instances

        Raises:
            BaseCustomException: On validation or creation errors
        """
        try:
            # Validate all requests
            validated_tasks = [
                TaskCreationSchema(**request).dict()
                for request in task_requests
            ]

            # Create tasks in batch
            with tracer.start_as_current_span("bulk_create_tasks") as span:
                span.set_attribute("task_count", len(validated_tasks))
                tasks = await self._repository.bulk_create_tasks(validated_tasks)

            # Send bulk notifications
            notification_requests = [
                {
                    "type": "task_created",
                    "recipient": str(task.assignee_id),
                    "subject": f"New Task Assigned: {task.title}",
                    "content": {
                        "task_id": str(task.id),
                        "title": task.title,
                        "priority": task.priority.value
                    }
                }
                for task in tasks
            ]
            await self._notification_service.send_bulk_notifications(notification_requests)

            # Track metrics
            track_metric(
                "task.bulk_created",
                len(tasks),
                tags={"batch_size": len(task_requests)}
            )

            return tasks

        except Exception as e:
            logger.error("Bulk task creation failed", error=str(e))
            raise BaseCustomException(
                message=f"Failed to create tasks in bulk: {str(e)}",
                error_code="TASK002"
            )

    @track_timing("task.get_details")
    async def get_task_details(self, task_id: uuid.UUID) -> Optional[Task]:
        """
        Retrieves task details with caching and monitoring.

        Args:
            task_id: UUID of the task

        Returns:
            Optional[Task]: Task details if found

        Raises:
            BaseCustomException: On retrieval errors
        """
        try:
            # Check cache
            cache_key = f"task:{str(task_id)}"
            cached_task = self._cache.get(cache_key)
            if cached_task:
                return Task.parse_raw(cached_task)

            # Retrieve from database
            with tracer.start_as_current_span("get_task") as span:
                span.set_attribute("task_id", str(task_id))
                task = await self._repository.get_task(task_id)

            if task:
                # Update cache
                self._cache.setex(
                    cache_key,
                    CACHE_TTL,
                    task.json()
                )

            return task

        except Exception as e:
            logger.error("Task retrieval failed", error=str(e), task_id=str(task_id))
            raise BaseCustomException(
                message=f"Failed to retrieve task: {str(e)}",
                error_code="TASK003"
            )

    @retry(
        stop=stop_after_attempt(MAX_RETRY_ATTEMPTS),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def _create_task_with_retry(self, task_data: TaskCreationSchema) -> Task:
        """Creates task with retry mechanism for resilience."""
        return await self._repository.create_task(**task_data.dict())

    async def _validate_task_completion(self, task: Task) -> bool:
        """Validates task completion requirements."""
        if task.status != TaskStatus.in_progress:
            return False

        if task.started_at:
            elapsed_time = (datetime.utcnow() - task.started_at).total_seconds()
            if elapsed_time > TASK_COMPLETION_TIMEOUT:
                return False

        return True