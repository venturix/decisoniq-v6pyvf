"""
SQLAlchemy model defining the core customer entity with enhanced health scoring
and risk assessment capabilities for the Customer Success AI Platform.

Version: SQLAlchemy 2.x
"""

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional
import json

from sqlalchemy import Column, DateTime, String, Float, JSON, event
from sqlalchemy.orm import relationship, declarative_mixin, validates
from sqlalchemy.dialects.postgresql import JSONB

from models.base import BaseModel

# Global configuration constants
HEALTH_SCORE_WEIGHTS = {
    "usage": 0.3,
    "engagement": 0.3,
    "support": 0.2,
    "financial": 0.2
}

RISK_SCORE_THRESHOLDS = {
    "low": 30,
    "medium": 60,
    "high": 90
}

CACHE_TTL = 300  # 5 minutes cache TTL

@declarative_mixin
class Customer(BaseModel):
    """
    SQLAlchemy model representing a customer account with enhanced health scoring
    and risk assessment capabilities.
    """

    # Core customer fields
    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Customer account name"
    )
    
    contract_start = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="Contract start date"
    )
    
    contract_end = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="Contract end date"
    )
    
    mrr = Column(
        "mrr",
        Decimal(precision=10, scale=2),
        nullable=False,
        comment="Monthly Recurring Revenue"
    )

    # Health and risk metrics
    health_score = Column(
        Float,
        nullable=False,
        default=0.0,
        comment="Composite health score (0-100)"
    )
    
    risk_score = Column(
        Float,
        nullable=False,
        default=0.0,
        comment="Risk assessment score (0-100)"
    )

    # Extended customer data
    metadata = Column(
        JSONB,
        nullable=False,
        default=dict,
        comment="Additional customer metadata"
    )

    # Relationships
    risk_profiles = relationship(
        "RiskProfile",
        back_populates="customer",
        lazy="selectin",
        cascade="all, delete-orphan"
    )

    # Calculation timestamps
    last_health_calculation = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last health score calculation timestamp"
    )
    
    last_risk_update = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last risk score update timestamp"
    )

    def __init__(
        self,
        name: str,
        contract_start: datetime,
        contract_end: datetime,
        mrr: Decimal,
        metadata: Dict = None
    ):
        """Initialize customer model with required fields and validation."""
        super().__init__()
        
        # Validate contract dates
        if contract_end <= contract_start:
            raise ValueError("Contract end date must be after start date")

        self.name = name
        self.contract_start = contract_start
        self.contract_end = contract_end
        self.mrr = mrr
        self.metadata = metadata or {}
        self.health_score = 0.0
        self.risk_score = 0.0
        self.last_health_calculation = None
        self.last_risk_update = None

        # Configure caching
        self.cache_hints = {
            "region": "customer_cache",
            "timeout": CACHE_TTL,
            "query_options": ["selectin_polymorphic"]
        }

    @validates('mrr', 'risk_score')
    def validate_numeric_fields(self, key: str, value: float) -> float:
        """Validate numeric fields to ensure they are within valid ranges."""
        if key == 'mrr' and value < 0:
            raise ValueError("MRR cannot be negative")
        if key == 'risk_score' and not 0 <= value <= 100:
            raise ValueError("Risk score must be between 0 and 100")
        return value

    def calculate_health_score(self, force_refresh: bool = False) -> float:
        """
        Calculate customer health score with caching and performance optimization.
        
        Args:
            force_refresh: Force recalculation even if cached value exists
            
        Returns:
            float: Calculated health score between 0 and 100
        """
        # Check cache unless force refresh
        if not force_refresh and self.last_health_calculation:
            cache_age = (datetime.utcnow() - self.last_health_calculation).total_seconds()
            if cache_age < CACHE_TTL:
                return self.health_score

        # Extract metrics from metadata
        usage_metrics = self.metadata.get('usage_metrics', {})
        engagement_metrics = self.metadata.get('engagement_metrics', {})
        support_metrics = self.metadata.get('support_metrics', {})
        financial_metrics = self.metadata.get('financial_metrics', {})

        # Calculate component scores
        usage_score = self._calculate_usage_score(usage_metrics)
        engagement_score = self._calculate_engagement_score(engagement_metrics)
        support_score = self._calculate_support_score(support_metrics)
        financial_score = self._calculate_financial_score(financial_metrics)

        # Apply weights
        weighted_score = (
            usage_score * HEALTH_SCORE_WEIGHTS['usage'] +
            engagement_score * HEALTH_SCORE_WEIGHTS['engagement'] +
            support_score * HEALTH_SCORE_WEIGHTS['support'] +
            financial_score * HEALTH_SCORE_WEIGHTS['financial']
        )

        # Update score and timestamp
        self.health_score = round(weighted_score, 2)
        self.last_health_calculation = datetime.utcnow()

        return self.health_score

    def update_risk_score(self, new_score: float, risk_factors: Dict) -> None:
        """
        Updates customer risk score with validation and audit logging.
        
        Args:
            new_score: Updated risk score value
            risk_factors: Dictionary of risk factors and their values
        """
        # Validate score
        if not 0 <= new_score <= 100:
            raise ValueError("Risk score must be between 0 and 100")

        # Create risk profile entry
        risk_profile = {
            "score": new_score,
            "factors": risk_factors,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Update score and metadata
        self.risk_score = new_score
        self.last_risk_update = datetime.utcnow()
        
        # Add to risk profiles
        if hasattr(self, 'risk_profiles'):
            from models.risk_profile import RiskProfile
            profile = RiskProfile(
                customer_id=self.id,
                score=new_score,
                factors=risk_factors
            )
            self.risk_profiles.append(profile)

        # Invalidate relevant caches
        self.cache_hints['invalidate'] = True

    def to_dict(self, include_computed: bool = True) -> Dict:
        """
        Converts customer model to dictionary with computed fields and caching.
        
        Args:
            include_computed: Include computed fields in output
            
        Returns:
            Dict containing complete customer representation
        """
        # Get base dictionary from parent
        result = super().to_dict()

        # Add computed fields if requested
        if include_computed:
            result.update({
                'health_score': self.health_score,
                'risk_score': self.risk_score,
                'risk_level': self._get_risk_level(),
                'days_until_renewal': self._calculate_days_until_renewal(),
                'lifetime_value': self._calculate_lifetime_value()
            })

        # Format special fields
        result['contract_start'] = self.contract_start.isoformat()
        result['contract_end'] = self.contract_end.isoformat()
        result['mrr'] = str(self.mrr)

        # Include risk profiles if loaded
        if 'risk_profiles' in result:
            result['risk_profiles'] = [
                profile.to_dict() for profile in self.risk_profiles
            ]

        return result

    def _calculate_usage_score(self, metrics: Dict) -> float:
        """Calculate usage component of health score."""
        if not metrics:
            return 0.0
        return min(100.0, (
            metrics.get('active_users', 0) * 0.4 +
            metrics.get('feature_adoption', 0) * 0.4 +
            metrics.get('login_frequency', 0) * 0.2
        ))

    def _calculate_engagement_score(self, metrics: Dict) -> float:
        """Calculate engagement component of health score."""
        if not metrics:
            return 0.0
        return min(100.0, (
            metrics.get('meeting_attendance', 0) * 0.3 +
            metrics.get('response_time', 0) * 0.3 +
            metrics.get('feedback_score', 0) * 0.4
        ))

    def _calculate_support_score(self, metrics: Dict) -> float:
        """Calculate support component of health score."""
        if not metrics:
            return 0.0
        return min(100.0, (
            metrics.get('ticket_resolution', 0) * 0.4 +
            metrics.get('satisfaction_score', 0) * 0.4 +
            metrics.get('response_time', 0) * 0.2
        ))

    def _calculate_financial_score(self, metrics: Dict) -> float:
        """Calculate financial component of health score."""
        if not metrics:
            return 0.0
        return min(100.0, (
            metrics.get('payment_history', 0) * 0.4 +
            metrics.get('mrr_growth', 0) * 0.4 +
            metrics.get('expansion_revenue', 0) * 0.2
        ))

    def _get_risk_level(self) -> str:
        """Determine risk level based on risk score thresholds."""
        if self.risk_score >= RISK_SCORE_THRESHOLDS['high']:
            return 'high'
        elif self.risk_score >= RISK_SCORE_THRESHOLDS['medium']:
            return 'medium'
        return 'low'

    def _calculate_days_until_renewal(self) -> int:
        """Calculate days remaining until contract renewal."""
        if not self.contract_end:
            return 0
        delta = self.contract_end - datetime.utcnow()
        return max(0, delta.days)

    def _calculate_lifetime_value(self) -> Decimal:
        """Calculate customer lifetime value based on MRR and contract duration."""
        if not all([self.mrr, self.contract_start, self.contract_end]):
            return Decimal('0.00')
        months = (self.contract_end.year - self.contract_start.year) * 12 + \
                (self.contract_end.month - self.contract_start.month)
        return self.mrr * Decimal(str(months))

# Register event listeners for enhanced functionality
@event.listens_for(Customer, 'before_update')
def update_risk_profile(mapper, connection, target):
    """Update risk profile before any update."""
    if hasattr(target, 'risk_score') and target.risk_score > 0:
        target.last_risk_update = datetime.utcnow()