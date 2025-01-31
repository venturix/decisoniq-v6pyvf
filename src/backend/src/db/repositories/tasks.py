"""
Repository module for managing task-related database operations in the Customer Success AI Platform.
Implements high-performance CRUD operations with caching, monitoring, and scalable task management.

Version: SQLAlchemy 2.x
Redis 4.x
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Union
from uuid import UUID

from sqlalchemy import select, and_, or_, desc
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from redis import Redis
from prometheus_client import Counter, Histogram

from models.task import Task, TaskStatus, TaskPriority, TaskType
from db.session import get_db
from core.exceptions import BaseCustomException

# Configure module logger
logger = logging.getLogger(__name__)

# Performance monitoring metrics
TASK_OPERATIONS = Counter(
    'task_operations_total',
    'Total number of task operations',
    ['operation_type']
)
TASK_OPERATION_DURATION = Histogram(
    'task_operation_duration_seconds',
    'Duration of task operations',
    ['operation_type']
)

# Cache configuration
CACHE_TTL = 300  # 5 minutes
CACHE_KEY_PREFIX = "task:"
MAX_BULK_SIZE = 1000

class TaskRepository:
    """
    Enhanced repository class for managing task-related database operations
    with performance optimization and monitoring capabilities.
    """

    def __init__(self, db_session: Session, cache_client: Redis):
        """
        Initialize task repository with database session and cache client.

        Args:
            db_session: SQLAlchemy database session
            cache_client: Redis cache client
        """
        self.db = db_session
        self.cache = cache_client
        self.logger = logging.getLogger(__name__)

    def create_task(
        self,
        title: str,
        description: str,
        customer_id: UUID,
        task_type: TaskType,
        assignee_id: UUID,
        priority: Optional[TaskPriority] = TaskPriority.medium,
        due_date: Optional[datetime] = None,
        metadata: Optional[Dict] = None
    ) -> Task:
        """
        Creates a new task with performance monitoring and validation.

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
            BaseCustomException: On validation or database errors
        """
        with TASK_OPERATION_DURATION.labels(operation_type='create').time():
            try:
                # Validate inputs
                if not title or not description:
                    raise ValueError("Title and description are required")

                # Create task instance
                task = Task(
                    title=title,
                    description=description,
                    customer_id=customer_id,
                    assignee_id=assignee_id,
                    task_type=task_type,
                    priority=priority,
                    due_date=due_date or datetime.utcnow(),
                    metadata=metadata or {}
                )

                # Add to database
                self.db.add(task)
                self.db.commit()
                self.db.refresh(task)

                # Invalidate relevant caches
                self._invalidate_task_caches(customer_id)

                # Record metrics
                TASK_OPERATIONS.labels(operation_type='create').inc()

                return task

            except SQLAlchemyError as e:
                self.db.rollback()
                self.logger.error(f"Task creation failed: {str(e)}")
                raise BaseCustomException(
                    message=f"Failed to create task: {str(e)}",
                    error_code="TASK001"
                )

    def bulk_create_tasks(self, task_data: List[Dict]) -> List[Task]:
        """
        Efficiently creates multiple tasks in batch with validation.

        Args:
            task_data: List of task creation parameters

        Returns:
            List[Task]: Created task instances

        Raises:
            BaseCustomException: On validation or database errors
        """
        with TASK_OPERATION_DURATION.labels(operation_type='bulk_create').time():
            try:
                # Validate batch size
                if len(task_data) > MAX_BULK_SIZE:
                    raise ValueError(f"Batch size exceeds maximum of {MAX_BULK_SIZE}")

                created_tasks = []
                for data in task_data:
                    task = Task(
                        title=data['title'],
                        description=data['description'],
                        customer_id=data['customer_id'],
                        assignee_id=data['assignee_id'],
                        task_type=data['task_type'],
                        priority=data.get('priority', TaskPriority.medium),
                        due_date=data.get('due_date', datetime.utcnow()),
                        metadata=data.get('metadata', {})
                    )
                    created_tasks.append(task)

                # Bulk insert tasks
                self.db.bulk_save_objects(created_tasks)
                self.db.commit()

                # Invalidate caches
                customer_ids = {task.customer_id for task in created_tasks}
                for customer_id in customer_ids:
                    self._invalidate_task_caches(customer_id)

                # Record metrics
                TASK_OPERATIONS.labels(operation_type='bulk_create').inc(len(created_tasks))

                return created_tasks

            except SQLAlchemyError as e:
                self.db.rollback()
                self.logger.error(f"Bulk task creation failed: {str(e)}")
                raise BaseCustomException(
                    message=f"Failed to create tasks in bulk: {str(e)}",
                    error_code="TASK002"
                )

    def get_tasks_by_filter(
        self,
        filters: Dict,
        limit: Optional[int] = 100,
        offset: Optional[int] = 0
    ) -> List[Task]:
        """
        Retrieves tasks using advanced filtering with caching support.

        Args:
            filters: Dictionary of filter parameters
            limit: Maximum number of tasks to return
            offset: Number of tasks to skip

        Returns:
            List[Task]: Filtered task list

        Raises:
            BaseCustomException: On query errors
        """
        with TASK_OPERATION_DURATION.labels(operation_type='get_filtered').time():
            try:
                # Generate cache key
                cache_key = self._generate_cache_key(filters, limit, offset)
                
                # Check cache
                cached_result = self.cache.get(cache_key)
                if cached_result:
                    return cached_result

                # Build base query
                query = select(Task)

                # Apply filters
                if filters.get('customer_id'):
                    query = query.filter(Task.customer_id == filters['customer_id'])
                if filters.get('status'):
                    query = query.filter(Task.status == filters['status'])
                if filters.get('priority'):
                    query = query.filter(Task.priority == filters['priority'])
                if filters.get('assignee_id'):
                    query = query.filter(Task.assignee_id == filters['assignee_id'])
                if filters.get('due_date_start'):
                    query = query.filter(Task.due_date >= filters['due_date_start'])
                if filters.get('due_date_end'):
                    query = query.filter(Task.due_date <= filters['due_date_end'])

                # Apply sorting
                sort_field = filters.get('sort_by', 'due_date')
                sort_order = filters.get('sort_order', 'desc')
                if sort_order == 'desc':
                    query = query.order_by(desc(getattr(Task, sort_field)))
                else:
                    query = query.order_by(getattr(Task, sort_field))

                # Apply pagination
                query = query.limit(limit).offset(offset)

                # Execute query with timeout
                result = self.db.execute(query).scalars().all()

                # Cache results
                self.cache.setex(
                    cache_key,
                    CACHE_TTL,
                    result
                )

                # Record metrics
                TASK_OPERATIONS.labels(operation_type='get_filtered').inc()

                return result

            except SQLAlchemyError as e:
                self.logger.error(f"Task retrieval failed: {str(e)}")
                raise BaseCustomException(
                    message=f"Failed to retrieve tasks: {str(e)}",
                    error_code="TASK003"
                )

    def _generate_cache_key(self, filters: Dict, limit: int, offset: int) -> str:
        """Generates a unique cache key for task queries."""
        key_parts = [CACHE_KEY_PREFIX]
        for k, v in sorted(filters.items()):
            key_parts.append(f"{k}:{v}")
        key_parts.extend([f"limit:{limit}", f"offset:{offset}"])
        return ":".join(key_parts)

    def _invalidate_task_caches(self, customer_id: UUID) -> None:
        """Invalidates all task-related caches for a customer."""
        pattern = f"{CACHE_KEY_PREFIX}*customer_id:{customer_id}*"
        for key in self.cache.scan_iter(pattern):
            self.cache.delete(key)