"""
Pydantic schemas for customer success metrics validation and serialization.
Provides comprehensive validation for health scores, risk assessments, and performance indicators.

Version: pydantic ^2.0.0
"""

from datetime import datetime
import uuid
from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field, validator, ConfigDict

from models.metrics import METRIC_TYPES, AGGREGATION_PERIODS

# Global validation constants
VALUE_MIN = 0.0
VALUE_MAX = 100.0

class BaseMetricSchema(BaseModel):
    """Base schema for common metric fields with enhanced validation."""
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "metric_type": "health_score",
                "value": 85.5,
                "created_at": "2024-01-20T10:00:00Z",
                "updated_at": "2024-01-20T10:00:00Z",
                "is_active": True,
                "audit_trail": {"validation_history": []}
            }
        }
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, description="Unique identifier for the metric")
    metric_type: str = Field(..., description="Type of metric being tracked")
    value: float = Field(..., description="Numeric value of the metric")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of creation")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of last update")
    is_active: bool = Field(default=True, description="Whether the metric is currently active")
    audit_trail: Dict[str, List[Any]] = Field(
        default_factory=lambda: {"validation_history": []},
        description="Audit history of metric changes"
    )

    @validator("value")
    def validate_value(cls, value: float) -> float:
        """Validate metric value within acceptable range."""
        if not isinstance(value, (int, float)):
            raise ValueError("Value must be numeric")
        
        if not VALUE_MIN <= float(value) <= VALUE_MAX:
            raise ValueError(f"Value must be between {VALUE_MIN} and {VALUE_MAX}")
            
        return float(value)

    @validator("metric_type")
    def validate_metric_type(cls, value: str) -> str:
        """Validate metric type against allowed types."""
        if value not in METRIC_TYPES:
            raise ValueError(f"Invalid metric type. Must be one of: {', '.join(METRIC_TYPES)}")
        return value

class CustomerMetricSchema(BaseMetricSchema):
    """Schema for individual customer-level metrics with metadata validation."""
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "customer_id": "123e4567-e89b-12d3-a456-426614174000",
                "metadata": {"segment": "enterprise"},
                "measured_at": "2024-01-20T10:00:00Z",
                "statistical_metadata": {"confidence": 0.95},
                "related_metrics": ["usage_rate", "engagement_score"]
            }
        }
    )

    customer_id: uuid.UUID = Field(..., description="ID of the customer")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context about the metric"
    )
    measured_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When the metric was measured"
    )
    statistical_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Statistical analysis metadata"
    )
    related_metrics: List[str] = Field(
        default_factory=list,
        description="Related metric types"
    )

    @validator("related_metrics")
    def validate_related_metrics(cls, value: List[str]) -> List[str]:
        """Validate that related metrics are valid metric types."""
        invalid_metrics = [m for m in value if m not in METRIC_TYPES]
        if invalid_metrics:
            raise ValueError(f"Invalid related metrics: {', '.join(invalid_metrics)}")
        return value

class AggregateMetricSchema(BaseMetricSchema):
    """Schema for aggregated metrics with statistical analysis support."""
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "aggregation_period": "monthly",
                "sample_size": 100,
                "breakdown": {"by_segment": {"enterprise": 85.5}},
                "period_start": "2024-01-01T00:00:00Z",
                "period_end": "2024-01-31T23:59:59Z",
                "statistical_analysis": {"mean": 85.5, "std_dev": 5.2},
                "segment_data": [{"segment": "enterprise", "value": 85.5}]
            }
        }
    )

    aggregation_period: str = Field(..., description="Time period for aggregation")
    sample_size: int = Field(..., ge=1, description="Number of samples in aggregate")
    breakdown: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="Segmented metric breakdown"
    )
    period_start: datetime = Field(..., description="Start of aggregation period")
    period_end: datetime = Field(..., description="End of aggregation period")
    statistical_analysis: Dict[str, float] = Field(
        default_factory=dict,
        description="Statistical analysis results"
    )
    segment_data: List[Dict[str, Union[str, float]]] = Field(
        default_factory=list,
        description="Detailed segment-level data"
    )

    @validator("aggregation_period")
    def validate_aggregation_period(cls, value: str) -> str:
        """Validate aggregation period against allowed periods."""
        if value not in AGGREGATION_PERIODS:
            raise ValueError(f"Invalid aggregation period. Must be one of: {', '.join(AGGREGATION_PERIODS)}")
        return value

    @validator("period_end")
    def validate_period_end(cls, value: datetime, values: Dict[str, Any]) -> datetime:
        """Validate period end is after period start."""
        if "period_start" in values and value <= values["period_start"]:
            raise ValueError("Period end must be after period start")
        return value

    @validator("statistical_analysis")
    def validate_statistical_analysis(cls, value: Dict[str, float]) -> Dict[str, float]:
        """Validate required statistical metrics are present."""
        required_metrics = {"mean", "std_dev"}
        missing_metrics = required_metrics - set(value.keys())
        if missing_metrics:
            raise ValueError(f"Missing required statistical metrics: {', '.join(missing_metrics)}")
        return value