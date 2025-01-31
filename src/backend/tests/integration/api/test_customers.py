"""
Integration tests for customer management API endpoints in the Customer Success AI Platform.
Validates CRUD operations, health scoring, risk assessment, performance, and security requirements.

Version: pytest 7.x
"""

import pytest
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any

from src.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse

# API endpoint prefix
API_PREFIX = "/api/v1/customers"

# Performance threshold from spec (3s requirement)
PERFORMANCE_THRESHOLD = 3.0

# Test customer data fixture
TEST_CUSTOMER_DATA = {
    "name": "Test Customer",
    "contract_start": datetime.now(),
    "contract_end": datetime.now() + timedelta(days=365),
    "mrr": Decimal("1000.00"),
    "metadata": {
        "usage_metrics": {
            "active_users": 100,
            "feature_adoption": 0.75
        },
        "engagement_metrics": {
            "login_frequency": 0.8,
            "feature_usage": 0.65
        },
        "support_metrics": {
            "ticket_volume": 10,
            "resolution_time": 24
        },
        "financial_metrics": {
            "payment_history": 1.0,
            "upsell_probability": 0.8
        }
    }
}

@pytest.mark.integration
@pytest.mark.security
class TestCustomerAPI:
    """Comprehensive test suite for Customer API endpoints with performance and security validation."""

    def setup_method(self, method):
        """Setup method with enhanced isolation."""
        self.test_data = TEST_CUSTOMER_DATA.copy()
        self.performance_metrics = []

    def teardown_method(self, method):
        """Cleanup method with security checks."""
        self.test_data = {}
        self.performance_metrics = []

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_create_customer(
        self,
        client,
        db_session,
        performance_monitor,
        security_validator
    ):
        """Test customer creation with performance and security validation."""
        # Start performance monitoring
        with performance_monitor() as monitor:
            response = await client.post(
                f"{API_PREFIX}/",
                json=self.test_data
            )

        # Validate response time
        assert monitor.duration < PERFORMANCE_THRESHOLD, \
            f"Response time {monitor.duration}s exceeds {PERFORMANCE_THRESHOLD}s threshold"

        # Validate response
        assert response.status_code == 201
        data = response.json()
        assert isinstance(data["id"], str)
        assert data["name"] == self.test_data["name"]

        # Validate security headers
        security_validator.validate_headers(response.headers)

    @pytest.mark.asyncio
    async def test_get_customer(
        self,
        client,
        db_session,
        performance_monitor,
        security_validator
    ):
        """Test customer retrieval with security validation."""
        # Create test customer first
        create_response = await client.post(
            f"{API_PREFIX}/",
            json=self.test_data
        )
        customer_id = create_response.json()["id"]

        # Get customer with performance monitoring
        with performance_monitor() as monitor:
            response = await client.get(f"{API_PREFIX}/{customer_id}")

        # Validate performance
        assert monitor.duration < PERFORMANCE_THRESHOLD

        # Validate response
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == customer_id
        assert data["name"] == self.test_data["name"]
        assert "health_score" in data
        assert "risk_score" in data

        # Validate security
        security_validator.validate_headers(response.headers)
        security_validator.validate_data_encryption(data)

    @pytest.mark.asyncio
    async def test_update_customer(
        self,
        client,
        db_session,
        performance_monitor,
        security_validator
    ):
        """Test customer update with audit trail."""
        # Create test customer
        create_response = await client.post(
            f"{API_PREFIX}/",
            json=self.test_data
        )
        customer_id = create_response.json()["id"]

        # Update data
        update_data = {
            "name": "Updated Customer",
            "mrr": Decimal("2000.00")
        }

        # Perform update with performance monitoring
        with performance_monitor() as monitor:
            response = await client.put(
                f"{API_PREFIX}/{customer_id}",
                json=update_data
            )

        # Validate performance
        assert monitor.duration < PERFORMANCE_THRESHOLD

        # Validate response
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert Decimal(data["mrr"]) == update_data["mrr"]

        # Validate audit trail
        audit_response = await client.get(f"{API_PREFIX}/{customer_id}/audit")
        audit_data = audit_response.json()
        assert len(audit_data) > 0
        assert audit_data[-1]["changes"]["name"]["new"] == update_data["name"]

    @pytest.mark.asyncio
    async def test_delete_customer(
        self,
        client,
        db_session,
        performance_monitor,
        security_validator
    ):
        """Test customer deletion with security validation."""
        # Create test customer
        create_response = await client.post(
            f"{API_PREFIX}/",
            json=self.test_data
        )
        customer_id = create_response.json()["id"]

        # Delete customer with performance monitoring
        with performance_monitor() as monitor:
            response = await client.delete(f"{API_PREFIX}/{customer_id}")

        # Validate performance
        assert monitor.duration < PERFORMANCE_THRESHOLD

        # Validate response
        assert response.status_code == 204

        # Verify soft deletion
        get_response = await client.get(f"{API_PREFIX}/{customer_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_customers(
        self,
        client,
        db_session,
        performance_monitor,
        security_validator
    ):
        """Test customer listing with pagination and filtering."""
        # Create multiple test customers
        for i in range(3):
            customer_data = self.test_data.copy()
            customer_data["name"] = f"Test Customer {i}"
            await client.post(f"{API_PREFIX}/", json=customer_data)

        # Test listing with performance monitoring
        with performance_monitor() as monitor:
            response = await client.get(
                f"{API_PREFIX}/",
                params={"page": 1, "size": 10}
            )

        # Validate performance
        assert monitor.duration < PERFORMANCE_THRESHOLD

        # Validate response
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 3
        assert data["total"] >= 3
        assert "page" in data
        assert "size" in data

        # Validate security
        security_validator.validate_headers(response.headers)

    @pytest.mark.asyncio
    async def test_customer_health_score(
        self,
        client,
        db_session,
        performance_monitor,
        security_validator
    ):
        """Test customer health score calculation."""
        # Create test customer
        create_response = await client.post(
            f"{API_PREFIX}/",
            json=self.test_data
        )
        customer_id = create_response.json()["id"]

        # Get health score with performance monitoring
        with performance_monitor() as monitor:
            response = await client.get(f"{API_PREFIX}/{customer_id}/health")

        # Validate performance
        assert monitor.duration < PERFORMANCE_THRESHOLD

        # Validate response
        assert response.status_code == 200
        data = response.json()
        assert "health_score" in data
        assert 0 <= data["health_score"] <= 100
        assert "health_factors" in data

    @pytest.mark.asyncio
    async def test_customer_risk_assessment(
        self,
        client,
        db_session,
        performance_monitor,
        security_validator
    ):
        """Test customer risk assessment functionality."""
        # Create test customer
        create_response = await client.post(
            f"{API_PREFIX}/",
            json=self.test_data
        )
        customer_id = create_response.json()["id"]

        # Get risk assessment with performance monitoring
        with performance_monitor() as monitor:
            response = await client.get(f"{API_PREFIX}/{customer_id}/risk")

        # Validate performance
        assert monitor.duration < PERFORMANCE_THRESHOLD

        # Validate response
        assert response.status_code == 200
        data = response.json()
        assert "risk_score" in data
        assert 0 <= data["risk_score"] <= 100
        assert "risk_factors" in data
        assert "recommendations" in data

    @pytest.mark.asyncio
    async def test_customer_data_validation(
        self,
        client,
        db_session,
        security_validator
    ):
        """Test customer data validation rules."""
        # Test invalid data
        invalid_data = self.test_data.copy()
        invalid_data["contract_end"] = invalid_data["contract_start"]

        response = await client.post(
            f"{API_PREFIX}/",
            json=invalid_data
        )

        # Validate error response
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        assert "contract_end" in str(data["detail"])

    @pytest.mark.asyncio
    async def test_customer_security_controls(
        self,
        client,
        db_session,
        security_validator
    ):
        """Test security controls and data protection."""
        # Create customer with sensitive data
        customer_data = self.test_data.copy()
        customer_data["metadata"]["sensitive_info"] = "test123"

        response = await client.post(
            f"{API_PREFIX}/",
            json=customer_data
        )

        # Validate data encryption
        assert response.status_code == 201
        data = response.json()
        assert security_validator.is_encrypted(data["metadata"]["sensitive_info"])

        # Validate security headers
        security_validator.validate_headers(response.headers)