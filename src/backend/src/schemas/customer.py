"""
Pydantic schemas for customer data validation and serialization in the Customer Success AI Platform.
Provides comprehensive validation rules, high-performance serialization, and ORM integration.

Version: pydantic 2.x
"""

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator, model_config

from models.customer import HEALTH_SCORE_WEIGHTS
from schemas.risk import RiskProfileResponse

# Metadata schema definition with strict typing
METADATA_SCHEMA = {
    "usage_metrics": Dict[str, float],
    "engagement_metrics": Dict[str, float],
    "support_metrics": Dict[str, float],
    "financial_metrics": Dict[str, Decimal],
    "custom_fields": Optional[Dict[str, Any]]
}

class CustomerBase(BaseModel):
    """Base Pydantic model for customer data validation."""
    
    model_config = model_config(from_attributes=True, validate_assignment=True)

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Customer account name"
    )
    contract_start: datetime = Field(
        ...,
        description="Contract start date"
    )
    contract_end: datetime = Field(
        ...,
        description="Contract end date"
    )
    mrr: Decimal = Field(
        ...,
        ge=Decimal('0'),
        max_digits=10,
        decimal_places=2,
        description="Monthly Recurring Revenue"
    )
    metadata: Dict = Field(
        default_factory=dict,
        description="Additional customer metadata"
    )

    @model_validator(mode='after')
    def validate_contract_dates(self) -> 'CustomerBase':
        """Validates contract start and end dates."""
        if self.contract_end <= self.contract_start:
            raise ValueError("Contract end date must be after start date")
        
        if (self.contract_end - self.contract_start).days < 30:
            raise ValueError("Minimum contract duration is 30 days")
        
        return self

    @field_validator('metadata')
    def validate_metadata(cls, v: Dict) -> Dict:
        """Validates customer metadata against defined schema."""
        for key, expected_type in METADATA_SCHEMA.items():
            if key in v and not isinstance(v[key], expected_type):
                raise ValueError(f"Invalid type for metadata field {key}")
        return v

class CustomerCreate(CustomerBase):
    """Schema for customer creation with required fields."""
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Acme Corporation",
                "contract_start": "2024-01-01T00:00:00Z",
                "contract_end": "2025-01-01T00:00:00Z",
                "mrr": "5000.00",
                "metadata": {
                    "usage_metrics": {"active_users": 100},
                    "engagement_metrics": {"meeting_attendance": 0.8},
                    "support_metrics": {"ticket_resolution": 0.95},
                    "financial_metrics": {"payment_history": "1.0"}
                }
            }
        }

class CustomerUpdate(BaseModel):
    """Schema for customer updates with optional fields."""
    
    model_config = model_config(from_attributes=True)

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    contract_end: Optional[datetime] = None
    mrr: Optional[Decimal] = Field(None, ge=Decimal('0'))
    metadata: Optional[Dict] = None

    @field_validator('mrr')
    def validate_mrr(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        """Validates MRR updates."""
        if v is not None and v < Decimal('0'):
            raise ValueError("MRR cannot be negative")
        return v

class CustomerInDB(CustomerBase):
    """Schema for database customer representation."""
    
    id: UUID
    health_score: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
        description="Composite health score"
    )
    risk_score: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
        description="Risk assessment score"
    )
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False

class CustomerResponse(CustomerInDB):
    """Schema for customer API responses with computed fields."""
    
    risk_profiles: List[RiskProfileResponse] = Field(
        default_factory=list,
        description="Associated risk profiles"
    )
    days_until_renewal: int = Field(
        default=0,
        description="Days remaining until contract renewal"
    )
    lifetime_value: Decimal = Field(
        default=Decimal('0.00'),
        description="Calculated customer lifetime value"
    )
    health_factors: Dict[str, float] = Field(
        default_factory=dict,
        description="Breakdown of health score components"
    )

    @property
    def compute_health_factors(self) -> Dict[str, float]:
        """Computes health score component breakdown."""
        if not self.metadata:
            return {}
            
        return {
            "usage": self.metadata.get("usage_metrics", {}).get("score", 0.0) * HEALTH_SCORE_WEIGHTS["usage"],
            "engagement": self.metadata.get("engagement_metrics", {}).get("score", 0.0) * HEALTH_SCORE_WEIGHTS["engagement"],
            "support": self.metadata.get("support_metrics", {}).get("score", 0.0) * HEALTH_SCORE_WEIGHTS["support"],
            "financial": self.metadata.get("financial_metrics", {}).get("score", 0.0) * HEALTH_SCORE_WEIGHTS["financial"]
        }

    @property
    def compute_days_until_renewal(self) -> int:
        """Calculates days remaining until contract renewal."""
        if not self.contract_end:
            return 0
        delta = self.contract_end - datetime.utcnow()
        return max(0, delta.days)

    @property
    def compute_lifetime_value(self) -> Decimal:
        """Calculates customer lifetime value."""
        if not all([self.mrr, self.contract_start, self.contract_end]):
            return Decimal('0.00')
        months = (self.contract_end.year - self.contract_start.year) * 12 + \
                (self.contract_end.month - self.contract_start.month)
        return self.mrr * Decimal(str(months))