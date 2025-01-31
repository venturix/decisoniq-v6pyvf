"""
Pydantic schemas for risk assessment data validation and serialization in the Customer Success AI Platform.
Provides comprehensive validation rules and performance optimizations for risk profiles and assessments.

Version: pydantic 2.x
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_config

from models.risk import RISK_SEVERITY_LEVELS, RISK_SCORE_THRESHOLDS

# Risk factor weight configuration
RISK_FACTOR_WEIGHTS = {
    "usage_decline": 0.35,
    "support_tickets": 0.25,
    "payment_delays": 0.25,
    "engagement_score": 0.15
}

class RiskFactorBase(BaseModel):
    """Base schema for risk factor data validation with enhanced validation rules."""
    
    model_config = model_config(from_attributes=True, validate_assignment=True)

    impact_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Impact score of the risk factor (0-1)"
    )
    category: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Category of the risk factor"
    )
    description: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Detailed description of the risk factor"
    )
    metadata: Dict = Field(
        default_factory=dict,
        description="Additional metadata for the risk factor"
    )
    confidence_score: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Confidence level in the risk factor assessment"
    )
    assessed_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp of risk factor assessment"
    )

    @field_validator('impact_score')
    def validate_impact_score(cls, value: float) -> float:
        """Validates impact score is within acceptable range."""
        return round(max(0.0, min(1.0, value)), 3)

class RiskProfileCreate(BaseModel):
    """Schema for creating new risk profile entries with comprehensive validation."""
    
    model_config = model_config(from_attributes=True, validate_assignment=True)

    customer_id: UUID = Field(
        ...,
        description="UUID of the associated customer"
    )
    score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Overall risk score (0-100)"
    )
    factors: List[RiskFactorBase] = Field(
        ...,
        min_items=1,
        description="List of risk factors contributing to the score"
    )
    recommendations: Dict = Field(
        default_factory=dict,
        description="Automated recommendations based on risk assessment"
    )
    version: str = Field(
        default="1.0",
        pattern=r"^\d+\.\d+$",
        description="Schema version for compatibility tracking"
    )
    metadata: Dict = Field(
        default_factory=dict,
        description="Additional risk profile metadata"
    )

    @field_validator('score')
    def validate_score(cls, value: float) -> float:
        """Validates risk score with enhanced rules."""
        if value >= RISK_SCORE_THRESHOLDS['CRITICAL']:
            return round(min(100.0, value), 2)
        return round(max(0.0, value), 2)

class RiskProfileResponse(BaseModel):
    """Schema for risk profile API responses with computed fields."""
    
    model_config = model_config(from_attributes=True, validate_assignment=True)

    id: UUID = Field(..., description="Unique identifier for the risk profile")
    customer_id: UUID = Field(..., description="Associated customer identifier")
    score: float = Field(..., description="Overall risk score")
    severity_level: int = Field(..., description="Computed severity level")
    factors: List[RiskFactorBase] = Field(..., description="Risk factors")
    recommendations: Dict = Field(..., description="Intervention recommendations")
    assessed_at: datetime = Field(..., description="Assessment timestamp")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    version: str = Field(..., description="Schema version")
    metadata: Dict = Field(..., description="Additional metadata")
    confidence_score: float = Field(
        default=1.0,
        description="Overall confidence in risk assessment"
    )
    trend_analysis: Dict = Field(
        default_factory=dict,
        description="Historical trend analysis"
    )

    @property
    def compute_severity(self) -> int:
        """Computes severity level from risk score."""
        if self.score >= RISK_SCORE_THRESHOLDS['CRITICAL']:
            return RISK_SEVERITY_LEVELS['CRITICAL']
        elif self.score >= RISK_SCORE_THRESHOLDS['HIGH']:
            return RISK_SEVERITY_LEVELS['HIGH']
        elif self.score >= RISK_SCORE_THRESHOLDS['MEDIUM']:
            return RISK_SEVERITY_LEVELS['MEDIUM']
        return RISK_SEVERITY_LEVELS['LOW']

class RiskProfileUpdate(BaseModel):
    """Schema for updating existing risk profiles with validation."""
    
    model_config = model_config(from_attributes=True, validate_assignment=True)

    score: Optional[float] = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Updated risk score"
    )
    factors: Optional[List[RiskFactorBase]] = Field(
        None,
        min_items=1,
        description="Updated risk factors"
    )
    recommendations: Optional[Dict] = Field(
        None,
        description="Updated recommendations"
    )
    version: Optional[str] = Field(
        None,
        pattern=r"^\d+\.\d+$",
        description="Schema version"
    )
    metadata: Optional[Dict] = Field(
        None,
        description="Updated metadata"
    )