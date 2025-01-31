"""
Integration tests for database repository implementations in Customer Success AI Platform.
Validates CRUD operations, query performance, data integrity, and security features.

Version: pytest 7.x
"""

import pytest
import uuid
from datetime import datetime, timedelta
import time
from decimal import Decimal

from src.db.repositories.users import UserRepository
from src.db.repositories.customers import CustomerRepository
from core.security import FieldEncryption
from core.exceptions import BaseCustomException

# Test constants
TEST_USER_EMAIL = "test@example.com"
TEST_USER_NAME = "Test User"
TEST_USER_ROLE = "cs_manager"
PERFORMANCE_THRESHOLD_MS = 3000  # 3s per spec

@pytest.mark.integration
async def test_user_repository_crud(db_session):
    """Test CRUD operations and security features for user repository."""
    
    # Initialize repository and security
    user_repo = UserRepository(db_session)
    field_encryption = FieldEncryption()
    
    # Test user creation with encrypted fields
    test_user_data = {
        "email": TEST_USER_EMAIL,
        "full_name": TEST_USER_NAME,
        "role": TEST_USER_ROLE,
        "password": "SecurePass123!@#"
    }
    
    # Create user and verify encryption
    created_user = await user_repo.create(**test_user_data)
    assert created_user is not None
    assert created_user.id is not None
    assert field_encryption.decrypt(created_user.email) == TEST_USER_EMAIL.lower()
    
    # Test retrieval with decryption
    retrieved_user = await user_repo.get_by_id(created_user.id)
    assert retrieved_user is not None
    assert field_encryption.decrypt(retrieved_user.email) == TEST_USER_EMAIL.lower()
    
    # Test role-based access
    users_by_role = await user_repo.get_by_role(TEST_USER_ROLE)
    assert any(user.id == created_user.id for user in users_by_role)
    
    # Test update with audit trail
    update_data = {"full_name": "Updated Test User"}
    updated_user = await user_repo.update(created_user.id, update_data)
    assert updated_user.full_name == "Updated Test User"
    assert len(updated_user.audit_log) > 0
    
    # Test secure deletion
    deleted = await user_repo.delete(created_user.id)
    assert deleted is True
    
    # Verify soft delete
    deleted_user = await user_repo.get_by_id(created_user.id)
    assert deleted_user is None

@pytest.mark.integration
async def test_customer_repository_crud(db_session):
    """Test CRUD operations and analytics for customer repository."""
    
    # Initialize repository
    customer_repo = CustomerRepository(db_session)
    
    # Test customer creation with health metrics
    test_customer_data = {
        "name": "Test Company",
        "contract_start": datetime.utcnow(),
        "contract_end": datetime.utcnow() + timedelta(days=365),
        "mrr": Decimal("1000.00"),
        "metadata": {
            "usage_metrics": {"active_users": 80, "feature_adoption": 70},
            "engagement_metrics": {"meeting_attendance": 90},
            "support_metrics": {"ticket_resolution": 85},
            "financial_metrics": {"payment_history": 100}
        }
    }
    
    # Create customer and verify data
    created_customer = await customer_repo.create(test_customer_data)
    assert created_customer is not None
    assert created_customer.id is not None
    assert created_customer.health_score > 0
    
    # Test risk assessment
    risk_data = {
        "score": 75.0,
        "factors": {
            "usage_decline": True,
            "support_tickets": 5,
            "payment_delays": False
        }
    }
    created_customer.update_risk_score(risk_data["score"], risk_data["factors"])
    assert created_customer.risk_score == 75.0
    
    # Test retrieval with computed fields
    retrieved_customer = await customer_repo.get_by_id(created_customer.id)
    assert retrieved_customer is not None
    assert retrieved_customer.health_score > 0
    assert retrieved_customer.risk_score == 75.0
    
    # Test at-risk customer query
    at_risk_customers = await customer_repo.get_at_risk(risk_threshold=70.0)
    assert any(customer.id == created_customer.id for customer in at_risk_customers)
    
    # Test update with metric recalculation
    update_data = {
        "metadata": {
            **test_customer_data["metadata"],
            "usage_metrics": {"active_users": 90, "feature_adoption": 85}
        }
    }
    updated_customer = await customer_repo.update(created_customer.id, update_data)
    assert updated_customer.health_score > created_customer.health_score
    
    # Test deletion
    deleted = await customer_repo.delete(created_customer.id)
    assert deleted is True

@pytest.mark.integration
@pytest.mark.performance
async def test_customer_repository_performance(db_session):
    """Test performance requirements for customer repository operations."""
    
    customer_repo = CustomerRepository(db_session)
    
    # Create test customers for performance testing
    test_customers = []
    for i in range(100):
        customer_data = {
            "name": f"Performance Test Company {i}",
            "contract_start": datetime.utcnow(),
            "contract_end": datetime.utcnow() + timedelta(days=365),
            "mrr": Decimal("1000.00"),
            "metadata": {
                "usage_metrics": {"active_users": 80},
                "engagement_metrics": {"meeting_attendance": 90}
            }
        }
        customer = await customer_repo.create(customer_data)
        test_customers.append(customer)
    
    # Test bulk query performance
    start_time = time.time()
    customers = await customer_repo.get_all(limit=100)
    query_time = (time.time() - start_time) * 1000
    assert query_time < PERFORMANCE_THRESHOLD_MS
    assert len(customers) == 100
    
    # Test filtered query performance
    start_time = time.time()
    filtered_customers = await customer_repo.get_all(
        filters={"min_health_score": 70.0},
        limit=50
    )
    filter_time = (time.time() - start_time) * 1000
    assert filter_time < PERFORMANCE_THRESHOLD_MS
    
    # Test risk assessment performance
    start_time = time.time()
    at_risk = await customer_repo.get_at_risk(risk_threshold=50.0)
    risk_time = (time.time() - start_time) * 1000
    assert risk_time < PERFORMANCE_THRESHOLD_MS

@pytest.mark.integration
async def test_repository_error_handling(db_session):
    """Test error handling and data integrity in repository operations."""
    
    user_repo = UserRepository(db_session)
    customer_repo = CustomerRepository(db_session)
    
    # Test invalid data handling
    with pytest.raises(BaseCustomException) as exc:
        await user_repo.create(
            email="invalid-email",
            full_name="",
            role="invalid_role"
        )
    assert exc.value.error_code == "USER002"
    
    # Test constraint violations
    test_user = await user_repo.create(
        email="constraint@test.com",
        full_name="Constraint Test",
        role=TEST_USER_ROLE,
        password="SecurePass123!@#"
    )
    
    with pytest.raises(BaseCustomException) as exc:
        await user_repo.create(
            email="constraint@test.com",  # Duplicate email
            full_name="Duplicate Test",
            role=TEST_USER_ROLE,
            password="SecurePass123!@#"
        )
    assert exc.value.error_code == "USER002"
    
    # Test transaction rollback
    customer_data = {
        "name": "Rollback Test",
        "contract_start": datetime.utcnow(),
        "contract_end": datetime.utcnow() - timedelta(days=1)  # Invalid dates
    }
    
    with pytest.raises(BaseCustomException) as exc:
        await customer_repo.create(customer_data)
    assert exc.value.error_code == "CUST004"
    
    # Verify no partial data was saved
    customers = await customer_repo.get_all(
        filters={"name": "Rollback Test"}
    )
    assert len(customers) == 0