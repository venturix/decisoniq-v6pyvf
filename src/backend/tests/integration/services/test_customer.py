"""
Integration tests for CustomerService class validating customer lifecycle management,
health scoring, risk assessment functionality, and performance metrics.

Version: pytest 7.x
"""

import pytest
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
import time
from typing import Dict, Any

from services.customer import CustomerService
from services.risk import RiskService
from core.exceptions import BaseCustomException

# Test data constants
TEST_CUSTOMER_DATA = {
    'name': 'Test Company',
    'contract_start': datetime.utcnow(),
    'contract_end': datetime.utcnow() + timedelta(days=365),
    'mrr': Decimal('5000.00'),
    'metadata': {
        'industry': 'Technology',
        'size': 'Enterprise',
        'region': 'North America',
        'usage_metrics': {
            'active_users': 85,
            'feature_adoption': 75,
            'login_frequency': 90
        },
        'engagement_metrics': {
            'meeting_attendance': 80,
            'response_time': 85,
            'feedback_score': 90
        },
        'support_metrics': {
            'ticket_resolution': 95,
            'satisfaction_score': 88,
            'response_time': 92
        },
        'financial_metrics': {
            'payment_history': 100,
            'mrr_growth': 15,
            'expansion_revenue': 25
        }
    }
}

# Health score configuration
HEALTH_SCORE_WEIGHTS = {
    'usage': 0.4,
    'engagement': 0.3,
    'support': 0.2,
    'financial': 0.1
}

# Performance thresholds
PERFORMANCE_THRESHOLDS = {
    'response_time': 3.0,  # 3 second SLA
    'batch_processing': 10.0
}

@pytest.fixture
def customer_service(db_session, performance_metrics):
    """Initialize CustomerService with test dependencies."""
    from services.customer import CustomerService
    from services.risk import RiskService
    
    risk_service = RiskService(
        risk_model=None,  # Mock will be injected
        risk_repository=None,  # Mock will be injected
        cache_client=None,  # Mock will be injected
        metrics_collector=performance_metrics
    )
    
    return CustomerService(
        repository=None,  # Mock will be injected
        risk_service=risk_service,
        cache_client=None,  # Mock will be injected
        metrics_client=performance_metrics
    )

@pytest.mark.integration
async def test_create_customer(customer_service, db_session, performance_metrics):
    """Test customer creation with initial health assessment and performance validation."""
    try:
        start_time = time.time()

        # Create test customer
        customer = await customer_service.create_customer(TEST_CUSTOMER_DATA)

        # Validate customer creation
        assert customer is not None
        assert customer.id is not None
        assert customer.name == TEST_CUSTOMER_DATA['name']
        assert customer.mrr == TEST_CUSTOMER_DATA['mrr']

        # Validate health score calculation
        health_score = await customer_service.calculate_customer_health(customer.id)
        assert 0 <= health_score <= 100
        
        # Validate initial risk assessment
        risk_profile = await customer_service._risk_service.get_risk_profile(customer.id)
        assert risk_profile is not None
        assert 0 <= risk_profile.score <= 100

        # Verify performance
        operation_time = time.time() - start_time
        assert operation_time < PERFORMANCE_THRESHOLDS['response_time']

        # Record metrics
        performance_metrics['request_count'] += 1
        performance_metrics['response_times'].append(operation_time)

    except Exception as e:
        performance_metrics['error_count'] += 1
        raise e

@pytest.mark.integration
async def test_customer_health_factors(customer_service, db_session):
    """Test health score calculation with weighted factors."""
    # Create customer with known metrics
    customer = await customer_service.create_customer(TEST_CUSTOMER_DATA)
    
    # Calculate health score
    health_score = await customer_service.calculate_customer_health(customer.id)
    
    # Validate individual components
    usage_score = customer.metadata['usage_metrics']['active_users'] * 0.4 + \
                 customer.metadata['usage_metrics']['feature_adoption'] * 0.4 + \
                 customer.metadata['usage_metrics']['login_frequency'] * 0.2
                 
    engagement_score = customer.metadata['engagement_metrics']['meeting_attendance'] * 0.3 + \
                      customer.metadata['engagement_metrics']['response_time'] * 0.3 + \
                      customer.metadata['engagement_metrics']['feedback_score'] * 0.4
                      
    support_score = customer.metadata['support_metrics']['ticket_resolution'] * 0.4 + \
                   customer.metadata['support_metrics']['satisfaction_score'] * 0.4 + \
                   customer.metadata['support_metrics']['response_time'] * 0.2
                   
    financial_score = customer.metadata['financial_metrics']['payment_history'] * 0.4 + \
                     customer.metadata['financial_metrics']['mrr_growth'] * 0.4 + \
                     customer.metadata['financial_metrics']['expansion_revenue'] * 0.2

    # Calculate composite score
    expected_score = (
        usage_score * HEALTH_SCORE_WEIGHTS['usage'] +
        engagement_score * HEALTH_SCORE_WEIGHTS['engagement'] +
        support_score * HEALTH_SCORE_WEIGHTS['support'] +
        financial_score * HEALTH_SCORE_WEIGHTS['financial']
    )

    # Validate score
    assert abs(health_score - expected_score) < 0.01
    assert 0 <= health_score <= 100

@pytest.mark.integration
async def test_customer_risk_assessment(customer_service, db_session):
    """Test integrated risk assessment functionality."""
    # Create customer with risk factors
    risk_data = {
        'usage_decline': 0.3,
        'support_tickets': 0.5,
        'payment_delays': 0.2,
        'engagement_score': 0.8
    }
    
    customer_data = TEST_CUSTOMER_DATA.copy()
    customer_data['risk_data'] = risk_data
    
    customer = await customer_service.create_customer(customer_data)
    
    # Get risk profile
    risk_profile = await customer_service._risk_service.get_risk_profile(customer.id)
    
    # Validate risk assessment
    assert risk_profile is not None
    assert 0 <= risk_profile.score <= 100
    
    # Validate risk factors
    for factor, score in risk_data.items():
        assert factor in risk_profile.factors
        assert abs(risk_profile.factors[factor]['value'] - score) < 0.01
        
    # Validate revenue impact
    revenue_impact = await customer_service._risk_service.calculate_revenue_impact(
        customer.id,
        risk_profile.score
    )
    assert revenue_impact > 0
    assert revenue_impact <= float(customer.mrr) * 12

@pytest.mark.integration
@pytest.mark.performance
async def test_customer_performance_metrics(customer_service, db_session, performance_metrics):
    """Test system performance for customer operations."""
    try:
        # Initialize metrics
        operation_times = []
        
        # Create multiple customers
        for _ in range(10):
            start_time = time.time()
            
            customer_data = TEST_CUSTOMER_DATA.copy()
            customer_data['name'] = f"Test Company {uuid.uuid4()}"
            
            customer = await customer_service.create_customer(customer_data)
            assert customer is not None
            
            operation_time = time.time() - start_time
            operation_times.append(operation_time)
            
            # Calculate health score
            health_score = await customer_service.calculate_customer_health(customer.id)
            assert 0 <= health_score <= 100
        
        # Validate performance metrics
        avg_response_time = sum(operation_times) / len(operation_times)
        assert avg_response_time < PERFORMANCE_THRESHOLDS['response_time']
        
        max_response_time = max(operation_times)
        assert max_response_time < PERFORMANCE_THRESHOLDS['response_time'] * 1.5
        
        # Record metrics
        performance_metrics['request_count'] += len(operation_times)
        performance_metrics['response_times'].extend(operation_times)
        
    except Exception as e:
        performance_metrics['error_count'] += 1
        raise e