"""
SQLAlchemy model for customer success tasks with enhanced lifecycle management,
performance tracking, and audit capabilities.

Version: SQLAlchemy 2.x
"""

from datetime import datetime
import enum
from typing import Dict, Optional
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, JSON, event
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property

from models.base import BaseModel

class TaskStatus(enum.Enum):
    """Task lifecycle status with validation rules."""
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"

class TaskPriority(enum.Enum):
    """Task priority levels for execution ordering."""
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"

class TaskType(enum.Enum):
    """Task types for categorization and automation."""
    manual = "manual"
    automated = "automated"
    follow_up = "follow_up"
    review = "review"

class Task(BaseModel):
    """
    SQLAlchemy model representing a customer success task with enhanced
    lifecycle management and performance tracking capabilities.
    """
    __tablename__ = "task"

    # Core task fields
    title = Column(String(255), nullable=False, index=True)
    description = Column(String(1000), nullable=False)
    
    # Relationships
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey('customer.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    assignee_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )
    playbook_id = Column(
        UUID(as_uuid=True),
        ForeignKey('playbook.id', ondelete='SET NULL'),
        nullable=True,
        index=True
    )

    # Task status and metadata
    status = Column(
        Enum(TaskStatus),
        nullable=False,
        default=TaskStatus.pending,
        index=True
    )
    priority = Column(
        Enum(TaskPriority),
        nullable=False,
        default=TaskPriority.medium,
        index=True
    )
    task_type = Column(
        Enum(TaskType),
        nullable=False,
        index=True
    )

    # Scheduling and tracking
    due_date = Column(DateTime(timezone=True), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    last_updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Extended data and metrics
    metadata = Column(
        JSONB,
        nullable=False,
        default=dict,
        comment="Additional task metadata and context"
    )
    performance_metrics = Column(
        JSONB,
        nullable=False,
        default=lambda: {
            "duration_ms": 0,
            "overdue_time_ms": 0,
            "status_changes": [],
            "completion_rate": 0
        }
    )
    audit_trail = Column(
        JSONB,
        nullable=False,
        default=list,
        comment="Comprehensive audit log of task changes"
    )

    def __init__(
        self,
        title: str,
        description: str,
        customer_id: UUID,
        assignee_id: UUID,
        task_type: TaskType,
        priority: TaskPriority,
        due_date: datetime,
        metadata: Dict = None
    ):
        """Initialize task with required fields and audit trail."""
        super().__init__()
        
        # Validate inputs
        if due_date <= datetime.utcnow():
            raise ValueError("Due date must be in the future")

        # Set core fields
        self.title = title
        self.description = description
        self.customer_id = customer_id
        self.assignee_id = assignee_id
        self.task_type = task_type
        self.priority = priority
        self.due_date = due_date
        self.metadata = metadata or {}
        
        # Initialize tracking fields
        self.status = TaskStatus.pending
        self.performance_metrics = {
            "duration_ms": 0,
            "overdue_time_ms": 0,
            "status_changes": [],
            "completion_rate": 0
        }
        
        # Initialize audit trail
        self.audit_trail = [{
            "timestamp": datetime.utcnow().isoformat(),
            "action": "created",
            "details": {
                "title": title,
                "customer_id": str(customer_id),
                "assignee_id": str(assignee_id),
                "task_type": task_type.value,
                "priority": priority.value,
                "due_date": due_date.isoformat()
            }
        }]

    @validates('status', 'priority', 'task_type')
    def validate_enums(self, key: str, value: enum.Enum) -> enum.Enum:
        """Validate enum fields with status transition rules."""
        if key == 'status' and hasattr(self, 'status'):
            valid_transitions = {
                TaskStatus.pending: [TaskStatus.in_progress, TaskStatus.cancelled],
                TaskStatus.in_progress: [TaskStatus.completed, TaskStatus.failed],
                TaskStatus.completed: [],
                TaskStatus.failed: [TaskStatus.pending],
                TaskStatus.cancelled: [TaskStatus.pending]
            }
            if value not in valid_transitions.get(self.status, []):
                raise ValueError(f"Invalid status transition from {self.status} to {value}")
        return value

    def start(self) -> None:
        """Mark task as in progress with validation and monitoring."""
        if self.status != TaskStatus.pending:
            raise ValueError("Only pending tasks can be started")

        self.status = TaskStatus.in_progress
        self.started_at = datetime.utcnow()
        
        # Update audit trail
        self.audit_trail.append({
            "timestamp": datetime.utcnow().isoformat(),
            "action": "started",
            "details": {"started_at": self.started_at.isoformat()}
        })
        
        # Update performance metrics
        self.performance_metrics["status_changes"].append({
            "from": TaskStatus.pending.value,
            "to": TaskStatus.in_progress.value,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        self.last_updated_at = datetime.utcnow()

    def complete(self, completion_metadata: Dict = None, performance_data: Dict = None) -> None:
        """Mark task as completed with comprehensive tracking."""
        if self.status != TaskStatus.in_progress:
            raise ValueError("Only in-progress tasks can be completed")

        self.status = TaskStatus.completed
        self.completed_at = datetime.utcnow()
        
        # Update metadata
        if completion_metadata:
            self.metadata.update(completion_metadata)
        
        # Calculate performance metrics
        duration = (self.completed_at - self.started_at).total_seconds() * 1000
        self.performance_metrics.update({
            "duration_ms": duration,
            "completion_rate": 1.0,
            **(performance_data or {})
        })
        
        # Update audit trail
        self.audit_trail.append({
            "timestamp": datetime.utcnow().isoformat(),
            "action": "completed",
            "details": {
                "completed_at": self.completed_at.isoformat(),
                "duration_ms": duration,
                "metadata": completion_metadata
            }
        })
        
        self.last_updated_at = datetime.utcnow()

    def fail(self, failure_reason: str, error_details: Dict = None) -> None:
        """Mark task as failed with detailed tracking."""
        if self.status != TaskStatus.in_progress:
            raise ValueError("Only in-progress tasks can be marked as failed")

        self.status = TaskStatus.failed
        failure_time = datetime.utcnow()
        
        # Update metadata with failure information
        self.metadata.update({
            "failure_reason": failure_reason,
            "error_details": error_details or {},
            "failed_at": failure_time.isoformat()
        })
        
        # Update performance metrics
        duration = (failure_time - self.started_at).total_seconds() * 1000
        self.performance_metrics.update({
            "duration_ms": duration,
            "completion_rate": 0.0,
            "failure_count": self.performance_metrics.get("failure_count", 0) + 1
        })
        
        # Update audit trail
        self.audit_trail.append({
            "timestamp": failure_time.isoformat(),
            "action": "failed",
            "details": {
                "reason": failure_reason,
                "error_details": error_details,
                "duration_ms": duration
            }
        })
        
        self.last_updated_at = datetime.utcnow()

    def cancel(self, cancellation_reason: str, cancellation_metadata: Dict = None) -> None:
        """Cancel the task with audit trail."""
        if self.status in [TaskStatus.completed, TaskStatus.failed]:
            raise ValueError("Completed or failed tasks cannot be cancelled")

        self.status = TaskStatus.cancelled
        cancel_time = datetime.utcnow()
        
        # Update metadata
        self.metadata.update({
            "cancellation_reason": cancellation_reason,
            **(cancellation_metadata or {})
        })
        
        # Update audit trail
        self.audit_trail.append({
            "timestamp": cancel_time.isoformat(),
            "action": "cancelled",
            "details": {
                "reason": cancellation_reason,
                "metadata": cancellation_metadata
            }
        })
        
        self.last_updated_at = datetime.utcnow()

    def is_overdue(self, grace_period_minutes: int = 0) -> bool:
        """Check if task is past due date with grace period handling."""
        if not self.due_date:
            return False
            
        current_time = datetime.utcnow()
        grace_period = datetime.timedelta(minutes=grace_period_minutes)
        is_overdue = current_time > (self.due_date + grace_period)
        
        # Update performance metrics if overdue
        if is_overdue:
            overdue_time = (current_time - self.due_date).total_seconds() * 1000
            self.performance_metrics["overdue_time_ms"] = overdue_time
            
        return is_overdue

@event.listens_for(Task, 'before_update')
def update_task_metrics(mapper, connection, target):
    """Update task metrics before any update."""
    target.last_updated_at = datetime.utcnow()