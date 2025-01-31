"""
Integration tests for risk assessment API endpoints in the Customer Success AI Platform.
Validates risk profile management, assessment operations, and security controls with
comprehensive performance monitoring.

Version: pytest 7.x
Dependencies:
- pytest==7.x
- fastapi==0.100+
- sqlalchemy==2.x
"""

import uuid
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from src.schemas.risk import (
    RiskProfileCreate,
    RiskProfileUpdate,
    RiskProfileResponse
)
from src.models.risk import RISK_SEVERITY_LEVELS, RISK_SCORE_THRESHOLDS

# API endpoint constants
BASE_URL = "/api/v1/risk"
PERFORMANCE_THRESHOLD = 3.0  # 3 second SLA requirement

@pytest.fixture
def test_customer_data() -> Dict:
    """Fixture providing test customer data with comprehensive risk factors."""
    return {
        "id": uuid.uuid4(),
        "name": "Test Enterprise Corp",
        "contract_start": datetime.utcnow() - timedelta(days=180),
        "contract_end": datetime.utcnow() + timedelta(days=180),
        "mrr": 10000.00,
        "metadata": {
            "industry": "Technology",
            "size": "Enterprise",
            "region": "North America"
        }
    }

@pytest.fixture
def test_risk_profile_data(test_customer_data) -> Dict:
    """Fixture providing comprehensive risk profile test data."""
    return {
        "customer_id": test_customer_data["id"],
        "score": 75.5,
        "factors": [
            {
                "category": "usage_decline",
                "impact_score": 0.8,
                "description": "Significant drop in feature usage",
                "metadata": {
                    "previous_usage": 0.9,
                    "current_usage": 0.5,
                    "affected_features": ["reporting", "analytics"]
                },
                "confidence_score": 0.95
            },
            {
                "category": "support_tickets",
                "impact_score": 0.6,
                "description": "Increased critical support tickets",
                "metadata": {
                    "ticket_count": 12,
                    "resolution_time": "48h",
                    "severity": "high"
                },
                "confidence_score": 0.9
            }
        ],
        "recommendations": {
            "priority": "high",
            "actions": [
                "Schedule executive review",
                "Conduct usage analysis workshop",
                "Review support ticket patterns"
            ]
        },
        "version": "1.0"
    }

@pytest.mark.integration
class TestRiskAPI:
    """Comprehensive test suite for Risk Assessment API endpoints."""

    def setup_method(self, method):
        """Setup test environment with security context and monitoring."""
        self.start_time = time.time()
        self.audit_log = []

    def teardown_method(self, method):
        """Cleanup and performance validation."""
        duration = time.time() - self.start_time
        assert duration < PERFORMANCE_THRESHOLD, f"Performance threshold exceeded: {duration}s"

    @pytest.mark.asyncio
    async def test_create_risk_profile(
        self,
        client: TestClient,
        db_session: Session,
        test_customer_data: Dict,
        test_risk_profile_data: Dict
    ):
        """Test creation of new risk profile with comprehensive validation."""
        
        # Create test customer
        response = client.post(
            "/api/v1/customers",
            json=test_customer_data
        )
        assert response.status_code == 201

        # Create risk profile
        start_time = time.time()
        response = client.post(
            f"{BASE_URL}/profiles",
            json=test_risk_profile_data
        )
        duration = time.time() - start_time

        # Validate response
        assert response.status_code == 201
        assert duration < PERFORMANCE_THRESHOLD

        data = response.json()
        assert data["customer_id"] == str(test_risk_profile_data["customer_id"])
        assert data["score"] == test_risk_profile_data["score"]
        assert len(data["factors"]) == len(test_risk_profile_data["factors"])
        assert "severity_level" in data
        assert "recommendations" in data

        # Validate database entry
        db_profile = db_session.query(RiskProfile).filter_by(
            customer_id=test_risk_profile_data["customer_id"]
        ).first()
        assert db_profile is not None
        assert db_profile.score == test_risk_profile_data["score"]

    @pytest.mark.asyncio
    async def test_get_risk_profile(
        self,
        client: TestClient,
        db_session: Session,
        test_risk_profile_data: Dict
    ):
        """Test retrieval of risk profile with performance monitoring."""
        
        # Create test profile
        profile_id = uuid.uuid4()
        response = client.post(
            f"{BASE_URL}/profiles",
            json=test_risk_profile_data
        )
        assert response.status_code == 201

        # Get profile
        start_time = time.time()
        response = client.get(f"{BASE_URL}/profiles/{profile_id}")
        duration = time.time() - start_time

        # Validate response
        assert response.status_code == 200
        assert duration < PERFORMANCE_THRESHOLD

        data = response.json()
        assert isinstance(data, dict)
        assert data["id"] == str(profile_id)
        assert "score" in data
        assert "factors" in data
        assert "severity_level" in data
        assert "recommendations" in data

    @pytest.mark.asyncio
    async def test_update_risk_profile(
        self,
        client: TestClient,
        db_session: Session,
        test_risk_profile_data: Dict
    ):
        """Test risk profile updates with validation."""
        
        # Create initial profile
        response = client.post(
            f"{BASE_URL}/profiles",
            json=test_risk_profile_data
        )
        profile_id = response.json()["id"]

        # Update data
        update_data = {
            "score": 85.0,
            "factors": [
                {
                    "category": "usage_decline",
                    "impact_score": 0.9,
                    "description": "Severe usage decline detected",
                    "confidence_score": 0.95
                }
            ]
        }

        # Perform update
        start_time = time.time()
        response = client.put(
            f"{BASE_URL}/profiles/{profile_id}",
            json=update_data
        )
        duration = time.time() - start_time

        # Validate response
        assert response.status_code == 200
        assert duration < PERFORMANCE_THRESHOLD

        data = response.json()
        assert data["score"] == update_data["score"]
        assert len(data["factors"]) == len(update_data["factors"])
        assert data["severity_level"] > 0

    @pytest.mark.asyncio
    async def test_get_high_risk_customers(
        self,
        client: TestClient,
        db_session: Session
    ):
        """Test high-risk customer identification endpoint."""
        
        start_time = time.time()
        response = client.get(
            f"{BASE_URL}/high-risk",
            params={"threshold": RISK_SCORE_THRESHOLDS["HIGH"]}
        )
        duration = time.time() - start_time

        # Validate response
        assert response.status_code == 200
        assert duration < PERFORMANCE_THRESHOLD

        data = response.json()
        assert isinstance(data, list)
        for customer in data:
            assert customer["risk_score"] >= RISK_SCORE_THRESHOLDS["HIGH"]
            assert "customer_id" in customer
            assert "severity_level" in customer

    @pytest.mark.asyncio
    async def test_risk_assessment_performance(
        self,
        client: TestClient,
        db_session: Session,
        test_risk_profile_data: Dict
    ):
        """Test risk assessment endpoint performance under load."""
        
        # Create multiple concurrent requests
        start_time = time.time()
        responses = []
        for _ in range(10):
            response = client.post(
                f"{BASE_URL}/assess",
                json=test_risk_profile_data
            )
            responses.append(response)
        duration = time.time() - start_time

        # Validate performance
        assert duration < PERFORMANCE_THRESHOLD
        for response in responses:
            assert response.status_code == 201
            data = response.json()
            assert "score" in data
            assert "severity_level" in data
            assert "recommendations" in data

    @pytest.mark.asyncio
    async def test_risk_profile_security(
        self,
        client: TestClient,
        db_session: Session
    ):
        """Test security controls for risk profile access."""
        
        # Test unauthorized access
        response = client.get(
            f"{BASE_URL}/profiles/{uuid.uuid4()}",
            headers={"Authorization": "Invalid"}
        )
        assert response.status_code == 401

        # Test invalid permissions
        response = client.post(
            f"{BASE_URL}/profiles",
            headers={"Authorization": "Bearer test_token_no_permissions"},
            json={}
        )
        assert response.status_code == 403

        # Validate audit logging
        audit_entry = db_session.query(AuditLog).filter_by(
            endpoint=f"{BASE_URL}/profiles"
        ).first()
        assert audit_entry is not None
        assert audit_entry.status_code in [401, 403]