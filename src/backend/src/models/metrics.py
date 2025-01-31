"""
SQLAlchemy models for customer success metrics with optimized performance and data partitioning.
Provides comprehensive metric tracking and analysis capabilities with sub-3s query performance.

Version: SQLAlchemy 2.x
"""

from datetime import datetime
import json
from typing import Dict, List, Optional, Any
from uuid import UUID
from sqlalchemy import Column, String, Float, JSON, DateTime, Boolean, Integer, event
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.sql import func

from models.base import BaseModel
from db.base import metadata

# Global configuration constants
METRIC_TYPES = [
    "health_score",
    "risk_score", 
    "usage_rate",
    "engagement_score",
    "revenue_impact",
    "churn_probability",
    "expansion_opportunity"
]

AGGREGATION_PERIODS = [
    "daily",
    "weekly", 
    "monthly",
    "quarterly",
    "annual"
]

PARTITION_INTERVAL = "30 days"
CACHE_TTL = 300  # 5 minutes

class CustomerMetric(BaseModel):
    """Enhanced model for individual customer-level metrics with performance optimizations."""
    
    __tablename__ = "customer_metrics"
    __table_args__ = {
        'postgresql_partition_by': 'RANGE (measured_at)',
        'info': {'partition_interval': PARTITION_INTERVAL}
    }

    # Core fields
    customer_id = Column(
        PGUUID(as_uuid=True),
        nullable=False,
        index=True,
        comment="Reference to customer"
    )
    metric_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of metric being tracked"
    )
    value = Column(
        Float,
        nullable=False,
        comment="Metric value"
    )
    metadata = Column(
        JSON,
        nullable=True,
        comment="Additional metric context"
    )
    measured_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="When metric was measured"
    )
    partition_key = Column(
        String,
        nullable=False,
        index=True,
        comment="Partition key for time-based access"
    )
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Whether metric is in active window"
    )
    validation_rules = Column(
        JSON,
        nullable=True,
        comment="Custom validation rules"
    )
    cache_version = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Cache invalidation version"
    )

    def __init__(
        self,
        customer_id: UUID,
        metric_type: str,
        value: float,
        metadata: Dict[str, Any],
        measured_at: datetime,
        validation_rules: Optional[Dict[str, Any]] = None
    ):
        """Initialize customer metric with enhanced validation."""
        super().__init__()
        
        if metric_type not in METRIC_TYPES:
            raise ValueError(f"Invalid metric type: {metric_type}")
            
        self.customer_id = customer_id
        self.metric_type = metric_type
        self.value = self.validate_value(value, validation_rules or {})
        self.metadata = metadata
        self.measured_at = measured_at
        self.validation_rules = validation_rules
        self.partition_key = self._generate_partition_key()
        self.is_active = self._check_active_window()
        self.cache_version = 1

    def validate_value(self, value: float, rules: Dict[str, Any]) -> float:
        """Enhanced metric value validation with custom rules support."""
        # Base validation
        if not isinstance(value, (int, float)):
            raise ValueError("Value must be numeric")
            
        # Apply metric-specific range validation
        if self.metric_type in ["health_score", "risk_score"]:
            if not 0 <= value <= 100:
                raise ValueError("Score must be between 0 and 100")
                
        # Apply custom validation rules
        if rules:
            min_value = rules.get("min_value")
            max_value = rules.get("max_value")
            if min_value is not None and value < min_value:
                raise ValueError(f"Value below minimum: {min_value}")
            if max_value is not None and value > max_value:
                raise ValueError(f"Value above maximum: {max_value}")
                
        return float(value)

    def calculate_trend(self, lookback_days: int = 30) -> Dict[str, Any]:
        """Calculates trend for individual customer metric."""
        from sqlalchemy import select, func
        
        # Query historical data
        query = select(CustomerMetric).where(
            CustomerMetric.customer_id == self.customer_id,
            CustomerMetric.metric_type == self.metric_type,
            CustomerMetric.measured_at >= func.now() - func.interval(f'{lookback_days} days'),
            CustomerMetric.is_active == True
        ).order_by(CustomerMetric.measured_at)
        
        # Calculate trend metrics
        values = [row.value for row in query.all()]
        if not values:
            return {"trend": "insufficient_data"}
            
        current = values[-1]
        previous = values[0] if len(values) > 1 else current
        change = ((current - previous) / previous) * 100 if previous != 0 else 0
        
        return {
            "trend": "increasing" if change > 0 else "decreasing",
            "change_percent": round(change, 2),
            "current_value": current,
            "previous_value": previous,
            "samples": len(values)
        }

    def _generate_partition_key(self) -> str:
        """Generate partition key based on measurement date."""
        return self.measured_at.strftime("%Y%m")

    def _check_active_window(self) -> bool:
        """Check if metric is within active data window."""
        return (datetime.utcnow() - self.measured_at).days <= 90

class AggregateMetric(BaseModel):
    """Enhanced model for aggregated metrics with advanced analytics capabilities."""
    
    __tablename__ = "aggregate_metrics"
    __table_args__ = {
        'postgresql_partition_by': 'RANGE (period_start)',
        'info': {'partition_interval': PARTITION_INTERVAL}
    }

    # Core fields
    metric_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of metric being aggregated"
    )
    aggregation_period = Column(
        String(20),
        nullable=False,
        index=True,
        comment="Aggregation time period"
    )
    value = Column(
        Float,
        nullable=False,
        comment="Aggregated metric value"
    )
    sample_size = Column(
        Integer,
        nullable=False,
        comment="Number of samples in aggregate"
    )
    breakdown = Column(
        JSON,
        nullable=True,
        comment="Segmented analysis data"
    )
    period_start = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="Start of aggregation period"
    )
    period_end = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="End of aggregation period"
    )
    partition_key = Column(
        String,
        nullable=False,
        index=True,
        comment="Partition key for time-based access"
    )
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether aggregate is current"
    )
    statistical_metadata = Column(
        JSON,
        nullable=True,
        comment="Statistical analysis metadata"
    )
    cache_version = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Cache invalidation version"
    )

    def __init__(
        self,
        metric_type: str,
        aggregation_period: str,
        value: float,
        sample_size: int,
        breakdown: Dict[str, Any],
        period_start: datetime,
        period_end: datetime,
        statistical_metadata: Optional[Dict[str, Any]] = None
    ):
        """Initialize aggregate metric with enhanced analytics capabilities."""
        super().__init__()
        
        if metric_type not in METRIC_TYPES:
            raise ValueError(f"Invalid metric type: {metric_type}")
        if aggregation_period not in AGGREGATION_PERIODS:
            raise ValueError(f"Invalid aggregation period: {aggregation_period}")
            
        self.metric_type = metric_type
        self.aggregation_period = aggregation_period
        self.value = value
        self.sample_size = sample_size
        self.breakdown = breakdown
        self.period_start = period_start
        self.period_end = period_end
        self.partition_key = self._generate_partition_key()
        self.is_active = True
        self.statistical_metadata = statistical_metadata or {}
        self.cache_version = 1

    def calculate_trends(self) -> Dict[str, Any]:
        """Advanced trend analysis with statistical significance."""
        from sqlalchemy import select, func
        
        # Query historical aggregates
        query = select(AggregateMetric).where(
            AggregateMetric.metric_type == self.metric_type,
            AggregateMetric.aggregation_period == self.aggregation_period,
            AggregateMetric.period_end <= self.period_start,
            AggregateMetric.is_active == True
        ).order_by(AggregateMetric.period_start.desc()).limit(12)
        
        historical = query.all()
        if not historical:
            return {"trend": "insufficient_data"}
            
        # Calculate statistical significance
        values = [h.value for h in historical]
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        
        return {
            "trend": self._determine_trend(values),
            "mean": round(mean, 2),
            "variance": round(variance, 2),
            "sample_size": len(values),
            "confidence_interval": self._calculate_confidence_interval(values)
        }

    def update_breakdown(self, new_data: Dict[str, Any], recalculate: bool = True) -> Dict[str, Any]:
        """Updates metric breakdown with new segment analysis."""
        if not isinstance(new_data, dict):
            raise ValueError("New data must be a dictionary")
            
        # Merge new data with existing breakdown
        self.breakdown.update(new_data)
        
        # Recalculate aggregates if requested
        if recalculate:
            self.value = self._calculate_weighted_average()
            self.cache_version += 1
            
        return self.breakdown

    def _generate_partition_key(self) -> str:
        """Generate partition key based on period start."""
        return self.period_start.strftime("%Y%m")

    def _determine_trend(self, values: List[float]) -> str:
        """Determine trend direction with confidence level."""
        if len(values) < 2:
            return "insufficient_data"
            
        changes = [values[i] - values[i-1] for i in range(1, len(values))]
        positive_changes = sum(1 for c in changes if c > 0)
        confidence = positive_changes / len(changes)
        
        if confidence > 0.7:
            return "strongly_increasing"
        elif confidence > 0.5:
            return "increasing"
        elif confidence < 0.3:
            return "strongly_decreasing"
        elif confidence < 0.5:
            return "decreasing"
        return "stable"

    def _calculate_confidence_interval(self, values: List[float], confidence: float = 0.95) -> Dict[str, float]:
        """Calculate confidence interval for trend analysis."""
        import math
        
        n = len(values)
        mean = sum(values) / n
        std_dev = math.sqrt(sum((x - mean) ** 2 for x in values) / (n - 1))
        margin = 1.96 * (std_dev / math.sqrt(n))  # 95% confidence
        
        return {
            "lower": round(mean - margin, 2),
            "upper": round(mean + margin, 2),
            "confidence": confidence
        }

    def _calculate_weighted_average(self) -> float:
        """Calculate weighted average from breakdown segments."""
        if not self.breakdown:
            return self.value
            
        total_weight = sum(segment.get("weight", 1) for segment in self.breakdown.values())
        weighted_sum = sum(
            segment.get("value", 0) * segment.get("weight", 1)
            for segment in self.breakdown.values()
        )
        
        return weighted_sum / total_weight if total_weight > 0 else 0

# Register event listeners for performance optimization
@event.listens_for(CustomerMetric, 'after_insert')
def invalidate_cache_on_insert(mapper, connection, target):
    """Invalidate related caches after metric insert."""
    target.cache_version += 1

@event.listens_for(AggregateMetric, 'after_update')
def update_statistical_metadata(mapper, connection, target):
    """Update statistical metadata on aggregate changes."""
    if target.statistical_metadata is None:
        target.statistical_metadata = {}
    target.statistical_metadata["last_updated"] = datetime.utcnow().isoformat()
    target.cache_version += 1