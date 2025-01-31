"""
SQLAlchemy model definitions for playbook and playbook execution entities in the Customer Success AI Platform.
Provides enhanced validation, performance optimization, and audit trail support.

Version: SQLAlchemy 2.x
"""

from datetime import datetime
import enum
from typing import Dict, Optional
import uuid

from sqlalchemy import Column, String, JSON, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import validates

from models.base import BaseModel

class PlaybookStatus(enum.Enum):
    """Enumeration of possible playbook statuses with transition rules."""
    draft = "draft"
    active = "active"
    archived = "archived"

    @property
    def allowed_transitions(self) -> list:
        """Define allowed status transitions."""
        transitions = {
            "draft": ["active"],
            "active": ["archived"],
            "archived": []
        }
        return transitions.get(self.value, [])

class PlaybookTriggerType(enum.Enum):
    """Enumeration of playbook trigger types with validation rules."""
    risk_score = "risk_score"
    health_score = "health_score"
    manual = "manual"
    scheduled = "scheduled"

    @property
    def validation_rules(self) -> Dict:
        """Define validation rules for trigger types."""
        rules = {
            "risk_score": {"min": 0, "max": 100},
            "health_score": {"min": 0, "max": 100},
            "manual": {},
            "scheduled": {"min_interval_minutes": 15}
        }
        return rules.get(self.value, {})

class Playbook(BaseModel):
    """SQLAlchemy model for playbook templates with enhanced validation and performance optimization."""
    __tablename__ = "playbook"

    # Core fields
    name = Column(String(255), nullable=False, index=True)
    description = Column(String(1000), nullable=True)
    steps = Column(JSONB, nullable=False)
    trigger_type = Column(Enum(PlaybookTriggerType), nullable=False)
    trigger_conditions = Column(JSONB, nullable=False)
    status = Column(
        Enum(PlaybookStatus),
        nullable=False,
        default=PlaybookStatus.draft,
        index=True
    )

    # Performance metrics and audit
    performance_metrics = Column(
        JSONB,
        nullable=False,
        default=lambda: {
            "avg_execution_time": 0,
            "success_rate": 0,
            "last_execution": None
        }
    )

    # Create composite index for common queries
    __table_args__ = (
        Index(
            'ix_playbook_status_trigger',
            'status',
            'trigger_type'
        ),
    )

    def __init__(
        self,
        name: str,
        description: str,
        steps: Dict,
        trigger_type: PlaybookTriggerType,
        trigger_conditions: Dict
    ):
        """Initialize playbook with required fields and validation."""
        super().__init__()
        self.name = name
        self.description = description
        self.validate_steps(steps)
        self.steps = steps
        self.trigger_type = trigger_type
        self.validate_triggers(trigger_conditions)
        self.trigger_conditions = trigger_conditions
        self.status = PlaybookStatus.draft

    @validates('status')
    def validate_status_transition(self, key: str, value: PlaybookStatus) -> PlaybookStatus:
        """Validate status transitions."""
        if hasattr(self, 'status'):
            if value.value not in self.status.allowed_transitions:
                raise ValueError(
                    f"Invalid status transition from {self.status} to {value}"
                )
        return value

    def validate_steps(self, steps: Dict) -> None:
        """Enhanced validation for playbook steps configuration."""
        required_fields = {'sequence', 'actions', 'error_handling'}
        if not all(field in steps for field in required_fields):
            raise ValueError(f"Missing required fields in steps: {required_fields}")

        # Validate action configuration
        for action in steps['actions']:
            if not all(k in action for k in ['type', 'parameters', 'timeout']):
                raise ValueError("Invalid action configuration")

        # Validate error handling
        if not isinstance(steps['error_handling'], dict):
            raise ValueError("Invalid error handling configuration")

    def validate_triggers(self, conditions: Dict) -> None:
        """Enhanced validation for trigger conditions with threshold checks."""
        rules = self.trigger_type.validation_rules

        if self.trigger_type in [PlaybookTriggerType.risk_score, PlaybookTriggerType.health_score]:
            threshold = conditions.get('threshold')
            if not isinstance(threshold, (int, float)):
                raise ValueError("Invalid threshold value")
            if threshold < rules['min'] or threshold > rules['max']:
                raise ValueError(f"Threshold must be between {rules['min']} and {rules['max']}")

        elif self.trigger_type == PlaybookTriggerType.scheduled:
            interval = conditions.get('interval_minutes')
            if not isinstance(interval, int) or interval < rules['min_interval_minutes']:
                raise ValueError(f"Interval must be at least {rules['min_interval_minutes']} minutes")

class PlaybookExecution(BaseModel):
    """SQLAlchemy model for tracking playbook execution with detailed metrics."""
    __tablename__ = "playbook_execution"

    # Foreign keys and relationships
    playbook_id = Column(
        UUID(as_uuid=True),
        ForeignKey('playbook.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey('customer.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    # Execution details
    status = Column(String(50), nullable=False, index=True)
    results = Column(JSONB, nullable=True)
    started_at = Column(JSONB, nullable=False)
    completed_at = Column(JSONB, nullable=True)

    # Performance tracking
    execution_metrics = Column(
        JSONB,
        nullable=False,
        default=lambda: {
            "duration_ms": 0,
            "step_metrics": {},
            "resource_usage": {}
        }
    )

    # Error tracking
    error_logs = Column(JSONB, nullable=True)

    def __init__(self, playbook_id: uuid.UUID, customer_id: uuid.UUID):
        """Initialize execution instance with tracking."""
        super().__init__()
        self.playbook_id = playbook_id
        self.customer_id = customer_id
        self.status = "pending"
        self.started_at = datetime.utcnow()

    def update_status(
        self,
        status: str,
        results: Optional[Dict] = None,
        metrics: Optional[Dict] = None
    ) -> None:
        """Updates execution status with comprehensive tracking."""
        valid_statuses = {
            "pending", "in_progress", "completed",
            "failed", "cancelled", "timeout"
        }
        
        if status not in valid_statuses:
            raise ValueError(f"Invalid status: {status}")

        self.status = status
        if results:
            self.results = results

        if metrics:
            self.execution_metrics.update(metrics)

        if status in {"completed", "failed", "cancelled", "timeout"}:
            self.completed_at = datetime.utcnow()