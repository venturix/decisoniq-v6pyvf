"""
SQLAlchemy model defining risk assessment profiles and scoring logic for customer accounts
in the Customer Success AI Platform with optimized performance and enhanced recommendation capabilities.

Version: SQLAlchemy 2.x
"""

from datetime import datetime
import json
from typing import Dict, Optional, List, Any

from sqlalchemy import Column, Float, Integer, ForeignKey, JSON, event
from sqlalchemy.orm import relationship, declarative_mixin
from sqlalchemy.dialects.postgresql import UUID, JSONB

from models.base import BaseModel
from models.customer import Customer

# Risk severity level constants
RISK_SEVERITY_LEVELS = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'CRITICAL': 4
}

# Risk score threshold constants
RISK_SCORE_THRESHOLDS = {
    'LOW': 25,
    'MEDIUM': 50,
    'HIGH': 75,
    'CRITICAL': 90
}

@declarative_mixin
class RiskProfile(BaseModel):
    """
    SQLAlchemy model representing a customer risk assessment profile with enhanced
    scoring and recommendation capabilities.
    """

    # Foreign key relationship to customer
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey('customer.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
        comment="Reference to associated customer"
    )

    # Risk assessment metrics
    score = Column(
        Float,
        nullable=False,
        index=True,
        comment="Calculated risk score (0-100)"
    )

    severity_level = Column(
        Integer,
        nullable=False,
        index=True,
        comment="Risk severity level (1-4)"
    )

    # Detailed risk analysis data
    factors = Column(
        JSONB,
        nullable=False,
        default=dict,
        comment="Detailed risk factors and weights"
    )

    recommendations = Column(
        JSONB,
        nullable=False,
        default=list,
        comment="Prioritized intervention recommendations"
    )

    # Assessment metadata
    assessed_at = Column(
        'assessed_at',
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        comment="Timestamp of risk assessment"
    )

    # Relationship to customer model
    customer = relationship(
        "Customer",
        back_populates="risk_profiles",
        lazy="selectin"
    )

    def __init__(
        self,
        customer_id: UUID,
        score: float,
        factors: Dict[str, Any]
    ) -> None:
        """
        Initialize risk profile with required fields and generate initial recommendations.
        """
        super().__init__()
        
        # Validate score range
        if not 0 <= score <= 100:
            raise ValueError("Risk score must be between 0 and 100")

        self.customer_id = customer_id
        self.score = score
        self.factors = factors
        self.severity_level = self.calculate_severity()
        self.recommendations = self.generate_recommendations()
        self.assessed_at = datetime.utcnow()

        # Configure caching for performance
        self.cache_hints = {
            "region": "risk_profile_cache",
            "timeout": 300,  # 5 minutes cache
            "query_options": ["selectin_polymorphic"]
        }

    def calculate_severity(self) -> int:
        """
        Calculates risk severity level based on score with enhanced granularity.
        """
        if self.score >= RISK_SCORE_THRESHOLDS['CRITICAL']:
            return RISK_SEVERITY_LEVELS['CRITICAL']
        elif self.score >= RISK_SCORE_THRESHOLDS['HIGH']:
            return RISK_SEVERITY_LEVELS['HIGH']
        elif self.score >= RISK_SCORE_THRESHOLDS['MEDIUM']:
            return RISK_SEVERITY_LEVELS['MEDIUM']
        return RISK_SEVERITY_LEVELS['LOW']

    def generate_recommendations(self) -> List[Dict[str, Any]]:
        """
        Generates prioritized intervention recommendations based on risk factors.
        """
        recommendations = []
        
        # Analyze risk factors and generate recommendations
        for factor, details in self.factors.items():
            weight = details.get('weight', 0)
            value = details.get('value', 0)
            
            if weight * value > 0.6:  # High impact factor
                recommendations.append({
                    'factor': factor,
                    'impact': weight * value,
                    'priority': 'high',
                    'suggested_actions': self._get_factor_recommendations(factor),
                    'timeline': 'immediate'
                })
            elif weight * value > 0.3:  # Medium impact factor
                recommendations.append({
                    'factor': factor,
                    'impact': weight * value,
                    'priority': 'medium',
                    'suggested_actions': self._get_factor_recommendations(factor),
                    'timeline': '7 days'
                })

        # Sort recommendations by impact
        recommendations.sort(key=lambda x: x['impact'], reverse=True)
        return recommendations

    def update_customer_risk(self) -> None:
        """
        Updates associated customer's risk score with change tracking.
        """
        if self.customer:
            self.customer.update_risk_score(
                new_score=self.score,
                risk_factors=self.factors
            )
            self.assessed_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """
        Converts risk profile to optimized dictionary representation.
        """
        base_dict = super().to_dict()
        
        # Add computed and formatted fields
        base_dict.update({
            'severity_label': self._get_severity_label(),
            'recommendations_count': len(self.recommendations),
            'high_priority_actions': self._count_high_priority_actions(),
            'assessed_at': self.assessed_at.isoformat(),
            'customer_name': self.customer.name if self.customer else None
        })

        return base_dict

    def _get_severity_label(self) -> str:
        """Get human-readable severity label."""
        for label, level in RISK_SEVERITY_LEVELS.items():
            if level == self.severity_level:
                return label.lower()
        return 'unknown'

    def _count_high_priority_actions(self) -> int:
        """Count number of high priority recommendations."""
        return sum(1 for rec in self.recommendations if rec['priority'] == 'high')

    def _get_factor_recommendations(self, factor: str) -> List[str]:
        """Get specific recommendations for a risk factor."""
        # Factor-specific recommendation mapping
        recommendation_map = {
            'usage_decline': [
                'Schedule product training session',
                'Review feature adoption metrics',
                'Send usage best practices guide'
            ],
            'payment_issues': [
                'Schedule financial review meeting',
                'Review billing history',
                'Discuss payment terms flexibility'
            ],
            'support_tickets': [
                'Analyze ticket patterns',
                'Schedule technical review',
                'Provide self-service resources'
            ],
            'engagement_drop': [
                'Schedule executive check-in',
                'Review success plan',
                'Increase touchpoint frequency'
            ]
        }
        return recommendation_map.get(factor, ['Review and assess factor impact'])

# Register event listeners for enhanced functionality
@event.listens_for(RiskProfile, 'after_insert')
def after_risk_profile_insert(mapper, connection, target):
    """Update customer risk score after new profile creation."""
    target.update_customer_risk()

@event.listens_for(RiskProfile, 'after_update')
def after_risk_profile_update(mapper, connection, target):
    """Refresh recommendations after significant changes."""
    if hasattr(target, '_sa_instance_state') and \
       target._sa_instance_state.modified_flags.intersection({'score', 'factors'}):
        target.recommendations = target.generate_recommendations()