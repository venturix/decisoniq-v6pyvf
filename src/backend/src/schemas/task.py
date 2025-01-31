"""
Pydantic schemas for task data validation and serialization in the Customer Success AI Platform.
Provides comprehensive validation rules and type checking for task-related operations.

Version: pydantic 2.x
"""

from datetime import datetime
from typing import Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from core.exceptions import DataValidationError
from models.task import TaskStatus, TaskPriority, TaskType

class TaskBase(BaseModel):
    """Base Pydantic model for task data validation with enhanced field validation."""
    
    title: str = Field(
        min_length=1,
        max_length=255,
        description="Task title"
    )
    
    description: str = Field(
        min_length=1,
        max_length=1000,
        description="Detailed task description"
    )
    
    customer_id: UUID = Field(
        description="UUID of the associated customer"
    )
    
    assignee_id: UUID = Field(
        description="UUID of the assigned CS representative"
    )
    
    playbook_id: Optional[UUID] = Field(
        default=None,
        description="Optional UUID of associated playbook"
    )
    
    task_type: TaskType = Field(
        description="Type of task (manual, automated, follow_up, review)"
    )
    
    priority: TaskPriority = Field(
        description="Task priority level"
    )
    
    due_date: datetime = Field(
        description="Task due date and time"
    )
    
    metadata: Optional[Dict] = Field(
        default=None,
        description="Additional task metadata"
    )

    def validate_dates(self, values: Dict) -> Dict:
        """
        Validates task dates to ensure they are valid and in the future.
        
        Args:
            values: Dictionary of field values
            
        Returns:
            Dict: Validated values
            
        Raises:
            DataValidationError: If date validation fails
        """
        if values.get('due_date'):
            if values['due_date'] <= datetime.utcnow():
                raise DataValidationError(
                    message="Due date must be in the future",
                    validation_errors={"due_date": ["Due date must be in the future"]}
                )
        return values

class TaskCreate(TaskBase):
    """Schema for creating new tasks with complete validation."""
    
    class Config:
        json_schema_extra = {
            "example": {
                "title": "Quarterly Business Review",
                "description": "Conduct QBR for enterprise customer",
                "customer_id": "123e4567-e89b-12d3-a456-426614174000",
                "assignee_id": "123e4567-e89b-12d3-a456-426614174001",
                "task_type": "manual",
                "priority": "high",
                "due_date": "2024-01-30T15:00:00Z"
            }
        }

class TaskUpdate(BaseModel):
    """Schema for updating existing tasks with partial field updates."""
    
    title: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255
    )
    
    description: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=1000
    )
    
    assignee_id: Optional[UUID] = Field(
        default=None
    )
    
    priority: Optional[TaskPriority] = Field(
        default=None
    )
    
    due_date: Optional[datetime] = Field(
        default=None
    )
    
    metadata: Optional[Dict] = Field(
        default=None
    )

class TaskResponse(TaskBase):
    """Schema for task API responses with computed fields."""
    
    id: UUID = Field(
        description="Task UUID"
    )
    
    status: TaskStatus = Field(
        description="Current task status"
    )
    
    completed_at: Optional[datetime] = Field(
        default=None,
        description="Task completion timestamp"
    )
    
    metadata: Dict = Field(
        default_factory=dict,
        description="Task metadata and context"
    )
    
    created_at: datetime = Field(
        description="Task creation timestamp"
    )
    
    updated_at: datetime = Field(
        description="Last update timestamp"
    )

class TaskStatusUpdate(BaseModel):
    """Schema for updating task status with validation rules."""
    
    status: TaskStatus = Field(
        description="New task status"
    )
    
    status_reason: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Reason for status change"
    )
    
    status_metadata: Optional[Dict] = Field(
        default=None,
        description="Additional status change metadata"
    )

    def validate_status_transition(
        self,
        current_status: TaskStatus,
        new_status: TaskStatus
    ) -> bool:
        """
        Validates if the requested status transition is allowed.
        
        Args:
            current_status: Current task status
            new_status: Requested new status
            
        Returns:
            bool: True if transition is valid
            
        Raises:
            DataValidationError: If transition is invalid
        """
        valid_transitions = {
            TaskStatus.pending: [TaskStatus.in_progress, TaskStatus.cancelled],
            TaskStatus.in_progress: [TaskStatus.completed, TaskStatus.failed],
            TaskStatus.completed: [],
            TaskStatus.failed: [TaskStatus.pending],
            TaskStatus.cancelled: [TaskStatus.pending]
        }
        
        if new_status not in valid_transitions.get(current_status, []):
            raise DataValidationError(
                message=f"Invalid status transition from {current_status} to {new_status}",
                validation_errors={
                    "status": [f"Cannot transition from {current_status} to {new_status}"]
                }
            )
        return True