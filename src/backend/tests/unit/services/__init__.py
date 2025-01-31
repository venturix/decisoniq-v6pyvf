"""
Package initialization file for unit tests of the Customer Success AI Platform's service layer.
Provides test fixtures, mocks, and utilities for testing core service classes that implement
business logic, with comprehensive coverage of authentication, customer management, and
automation workflows.

Version: 1.0.0
"""

import pytest
from unittest.mock import MagicMock, patch
import json
from datetime import datetime, timedelta
import uuid

from services.auth import AuthService
from services.customer import CustomerService
from services.playbook import PlaybookService

# Test configuration constants
TEST_VERSION = '1.0.0'
TEST_TIMEOUT = 30
COVERAGE_THRESHOLD = 90

@pytest.fixture(scope='function')
@pytest.mark.timeout(30)
async def setup_service_mocks(request):
    """
    Creates and configures mock instances of core services with predefined behaviors
    and return values for testing.

    Args:
        request: pytest fixture request object

    Returns:
        Dictionary containing mock service instances with configured behaviors
    """
    # Create mock instances
    auth_service_mock = MagicMock(spec=AuthService)
    customer_service_mock = MagicMock(spec=CustomerService)
    playbook_service_mock = MagicMock(spec=PlaybookService)

    # Configure auth service mocks
    auth_service_mock.authenticate_user.return_value = {
        'access_token': 'test_token',
        'refresh_token': 'test_refresh',
        'token_type': 'bearer',
        'expires_in': 1800
    }

    auth_service_mock.authenticate_sso.return_value = {
        'access_token': 'test_sso_token',
        'user': {'id': str(uuid.uuid4()), 'email': 'test@example.com'}
    }

    auth_service_mock.validate_token.return_value = True

    # Configure customer service mocks
    customer_service_mock.calculate_health_score.return_value = 85.5
    customer_service_mock.calculate_risk_score.return_value = 35.0
    customer_service_mock.get_customer_metrics.return_value = {
        'usage': 0.8,
        'engagement': 0.75,
        'support': 0.9
    }

    # Configure playbook service mocks
    playbook_service_mock.execute_playbook.return_value = {
        'execution_id': str(uuid.uuid4()),
        'status': 'completed',
        'results': {'success': True}
    }

    playbook_service_mock.get_execution_status.return_value = {
        'status': 'completed',
        'metrics': {'duration_ms': 1500}
    }

    playbook_service_mock.validate_playbook.return_value = True

    # Create mock cache client
    cache_mock = MagicMock()
    cache_mock.get.return_value = None
    cache_mock.set.return_value = True

    # Create mock metrics client
    metrics_mock = MagicMock()
    metrics_mock.increment.return_value = None
    metrics_mock.gauge.return_value = None

    # Return configured mocks
    return {
        'auth_service': auth_service_mock,
        'customer_service': customer_service_mock,
        'playbook_service': playbook_service_mock,
        'cache_client': cache_mock,
        'metrics_client': metrics_mock
    }

@pytest.fixture(scope='session')
def setup_test_data():
    """
    Initializes test data fixtures with sample customer profiles, health scores,
    and playbook definitions.

    Returns:
        Dictionary containing test data fixtures
    """
    # Sample customer profiles
    customers = [
        {
            'id': str(uuid.uuid4()),
            'name': 'Test Company A',
            'health_score': 85,
            'risk_score': 25,
            'mrr': 5000.00,
            'contract_start': datetime.utcnow() - timedelta(days=180),
            'contract_end': datetime.utcnow() + timedelta(days=185),
            'metadata': {
                'industry': 'Technology',
                'size': 'Enterprise',
                'region': 'NA'
            }
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Test Company B',
            'health_score': 65,
            'risk_score': 75,
            'mrr': 3000.00,
            'contract_start': datetime.utcnow() - timedelta(days=90),
            'contract_end': datetime.utcnow() + timedelta(days=275),
            'metadata': {
                'industry': 'Healthcare',
                'size': 'Mid-Market',
                'region': 'EU'
            }
        }
    ]

    # Sample playbook templates
    playbooks = [
        {
            'id': str(uuid.uuid4()),
            'name': 'High Risk Intervention',
            'trigger_type': 'risk_score',
            'trigger_conditions': {'threshold': 75},
            'steps': {
                'sequence': [
                    {'id': 'notify_csm', 'type': 'notification'},
                    {'id': 'create_task', 'type': 'task_creation'}
                ]
            }
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Health Check',
            'trigger_type': 'scheduled',
            'trigger_conditions': {'interval_minutes': 1440},
            'steps': {
                'sequence': [
                    {'id': 'collect_metrics', 'type': 'data_collection'},
                    {'id': 'analyze_health', 'type': 'analysis'}
                ]
            }
        }
    ]

    # Sample risk profiles
    risk_profiles = [
        {
            'customer_id': customers[0]['id'],
            'score': 25,
            'factors': {
                'usage_decline': 0.2,
                'support_tickets': 0.3
            }
        },
        {
            'customer_id': customers[1]['id'],
            'score': 75,
            'factors': {
                'usage_decline': 0.8,
                'support_tickets': 0.7
            }
        }
    ]

    return {
        'customers': customers,
        'playbooks': playbooks,
        'risk_profiles': risk_profiles
    }