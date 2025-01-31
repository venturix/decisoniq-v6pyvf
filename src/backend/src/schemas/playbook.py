"""
Pydantic schema definitions for playbook-related data validation and serialization.
Provides comprehensive validation rules for playbook configuration, execution tracking,
and performance metrics in the Customer Success AI Platform.

Version: pydantic 2.x
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID
import pydantic

from models.playbook import PlaybookStatus, PlaybookTriggerType

class PlaybookStepSchema(pydantic.BaseModel):
    """Schema for validating individual playbook step configuration with enhanced validation."""
    step_id: str = pydantic.Field(
        ...,
        min_length=1,
        max_length=50,
        pattern=r'^[a-zA-Z0-9_-]+$',
        description="Unique identifier for the playbook step"
    )
    action_type: str = pydantic.Field(
        ...,
        description="Type of action to be executed"
    )
    action_config: Dict = pydantic.Field(
        ...,
        description="Configuration parameters for the action"
    )
    next_step: Optional[str] = pydantic.Field(
        None,
        description="ID of the next step in sequence"
    )
    conditions: Optional[Dict] = pydantic.Field(
        None,
        description="Conditional logic for step execution"
    )
    dependencies: Optional[List[str]] = pydantic.Field(
        None,
        description="List of step IDs that must complete before this step"
    )
    timeout_seconds: Optional[int] = pydantic.Field(
        default=300,
        ge=1,
        le=3600,
        description="Maximum execution time in seconds"
    )
    retry_config: Optional[Dict] = pydantic.Field(
        default_factory=lambda: {
            "max_attempts": 3,
            "delay_seconds": 5
        },
        description="Retry configuration for failed steps"
    )

    @pydantic.validator('action_config')
    def validate_action_config(cls, v: Dict) -> Dict:
        """Validate action configuration structure."""
        required_fields = {'type', 'parameters'}
        if not all(field in v for field in required_fields):
            raise ValueError(f"Missing required fields in action_config: {required_fields}")
        return v

    @pydantic.validator('conditions')
    def validate_conditions(cls, v: Optional[Dict]) -> Optional[Dict]:
        """Validate conditional logic structure."""
        if v is not None:
            required_fields = {'operator', 'rules'}
            if not all(field in v for field in required_fields):
                raise ValueError(f"Missing required fields in conditions: {required_fields}")
        return v

class PlaybookCreateSchema(pydantic.BaseModel):
    """Schema for playbook creation request validation with enhanced rules."""
    name: str = pydantic.Field(
        ...,
        min_length=3,
        max_length=255,
        description="Name of the playbook"
    )
    description: str = pydantic.Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Detailed description of the playbook"
    )
    steps: List[PlaybookStepSchema] = pydantic.Field(
        ...,
        min_items=1,
        description="Ordered list of playbook steps"
    )
    trigger_type: PlaybookTriggerType = pydantic.Field(
        ...,
        description="Type of trigger that initiates the playbook"
    )
    trigger_conditions: Dict = pydantic.Field(
        ...,
        description="Conditions that must be met to trigger execution"
    )
    performance_targets: Optional[Dict] = pydantic.Field(
        None,
        description="Target metrics for playbook performance"
    )
    notification_config: Optional[Dict] = pydantic.Field(
        None,
        description="Configuration for execution notifications"
    )
    version: Optional[str] = pydantic.Field(
        None,
        pattern=r'^\d+\.\d+\.\d+$',
        description="Semantic version of the playbook"
    )

    @pydantic.validator('steps')
    def validate_step_sequence(cls, v: List[PlaybookStepSchema]) -> List[PlaybookStepSchema]:
        """Validate step sequence and dependencies."""
        step_ids = {step.step_id for step in v}
        for step in v:
            if step.next_step and step.next_step not in step_ids:
                raise ValueError(f"Invalid next_step reference: {step.next_step}")
            if step.dependencies:
                if not all(dep in step_ids for dep in step.dependencies):
                    raise ValueError(f"Invalid dependency reference in step {step.step_id}")
        return v

class PlaybookResponseSchema(pydantic.BaseModel):
    """Schema for playbook API responses with caching support."""
    id: UUID = pydantic.Field(
        ...,
        description="Unique identifier of the playbook"
    )
    name: str = pydantic.Field(
        ...,
        description="Name of the playbook"
    )
    description: str = pydantic.Field(
        ...,
        description="Detailed description of the playbook"
    )
    steps: List[PlaybookStepSchema] = pydantic.Field(
        ...,
        description="Ordered list of playbook steps"
    )
    trigger_type: PlaybookTriggerType = pydantic.Field(
        ...,
        description="Type of trigger that initiates the playbook"
    )
    trigger_conditions: Dict = pydantic.Field(
        ...,
        description="Conditions that must be met to trigger execution"
    )
    status: PlaybookStatus = pydantic.Field(
        ...,
        description="Current status of the playbook"
    )
    created_at: datetime = pydantic.Field(
        ...,
        description="Timestamp of playbook creation"
    )
    updated_at: datetime = pydantic.Field(
        ...,
        description="Timestamp of last update"
    )
    performance_metrics: Optional[Dict] = pydantic.Field(
        None,
        description="Current performance metrics"
    )
    cache_key: Optional[str] = pydantic.Field(
        None,
        description="Cache key for response caching"
    )
    cache_ttl: Optional[int] = pydantic.Field(
        None,
        description="Cache TTL in seconds"
    )

class PlaybookExecutionSchema(pydantic.BaseModel):
    """Schema for playbook execution tracking with enhanced metrics."""
    id: UUID = pydantic.Field(
        ...,
        description="Unique identifier of the execution"
    )
    playbook_id: UUID = pydantic.Field(
        ...,
        description="ID of the executed playbook"
    )
    customer_id: UUID = pydantic.Field(
        ...,
        description="ID of the target customer"
    )
    status: str = pydantic.Field(
        ...,
        description="Current execution status"
    )
    results: Dict = pydantic.Field(
        ...,
        description="Execution results and outcomes"
    )
    started_at: datetime = pydantic.Field(
        ...,
        description="Execution start timestamp"
    )
    completed_at: Optional[datetime] = pydantic.Field(
        None,
        description="Execution completion timestamp"
    )
    created_at: datetime = pydantic.Field(
        ...,
        description="Record creation timestamp"
    )
    updated_at: datetime = pydantic.Field(
        ...,
        description="Last update timestamp"
    )
    performance_metrics: Dict = pydantic.Field(
        ...,
        description="Execution performance metrics"
    )
    step_metrics: List[Dict] = pydantic.Field(
        ...,
        description="Step-level performance metrics"
    )
    error_details: Optional[Dict] = pydantic.Field(
        None,
        description="Details of any execution errors"
    )
    audit_trail: Optional[Dict] = pydantic.Field(
        None,
        description="Audit trail of execution events"
    )

    @pydantic.validator('status')
    def validate_status(cls, v: str) -> str:
        """Validate execution status value."""
        valid_statuses = {
            'pending', 'in_progress', 'completed',
            'failed', 'cancelled', 'timeout'
        }
        if v not in valid_statuses:
            raise ValueError(f"Invalid status: {v}")
        return v