"""
Integration tests for playbook management API endpoints in the Customer Success AI Platform.
Validates performance, reliability, and compliance requirements with comprehensive test coverage.

Dependencies:
- pytest==7.x
- datadog==1.x
"""

import pytest
import uuid
import time
from typing import Dict, Any
from datetime import datetime

from datadog import statsd
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.schemas.playbook import (
    PlaybookCreateSchema,
    PlaybookResponseSchema,
    PlaybookStepSchema,
    PlaybookTriggerType,
    PlaybookStatus
)
from src.core.exceptions import BaseCustomException

# API endpoint configuration
API_PREFIX = "/api/v1/playbooks"
PERFORMANCE_THRESHOLD = 3.0  # 3 second SLA requirement

# Test data constants
TEST_PLAYBOOK_DATA = {
    "name": "Customer Onboarding Playbook",
    "description": "Automated onboarding workflow for new enterprise customers",
    "steps": [
        {
            "step_id": "welcome_email",
            "action_type": "email",
            "action_config": {
                "type": "template",
                "parameters": {
                    "template_id": "welcome_enterprise",
                    "delay_minutes": 0
                }
            },
            "timeout_seconds": 300
        },
        {
            "step_id": "schedule_kickoff",
            "action_type": "calendar",
            "action_config": {
                "type": "meeting",
                "parameters": {
                    "duration_minutes": 60,
                    "attendees": ["csm", "customer"]
                }
            },
            "dependencies": ["welcome_email"]
        }
    ],
    "trigger_type": PlaybookTriggerType.manual,
    "trigger_conditions": {
        "customer_type": "enterprise",
        "contract_value_min": 50000
    },
    "compliance_settings": {
        "data_retention": "90d",
        "audit_level": "detailed"
    }
}

@pytest.mark.integration
class TestPlaybookAPI:
    """Integration test suite for playbook API endpoints with performance monitoring."""

    def setup_method(self, method):
        """Initialize test environment and monitoring."""
        self.metrics = {
            'start_time': datetime.utcnow(),
            'request_count': 0,
            'error_count': 0,
            'response_times': []
        }

    def teardown_method(self, method):
        """Clean up test data and export metrics."""
        # Export test metrics to Datadog
        avg_response_time = sum(self.metrics['response_times']) / len(self.metrics['response_times']) if self.metrics['response_times'] else 0
        
        statsd.gauge('test.playbook.avg_response_time', avg_response_time)
        statsd.gauge('test.playbook.error_rate', self.metrics['error_count'] / self.metrics['request_count'] if self.metrics['request_count'] else 0)
        statsd.gauge('test.playbook.request_count', self.metrics['request_count'])

    @pytest.mark.performance
    def test_create_playbook(self, client: TestClient, db_session: Session):
        """Test playbook creation with performance validation."""
        # Start performance timer
        start_time = time.time()

        try:
            # Create playbook request
            response = client.post(
                f"{API_PREFIX}/",
                json=TEST_PLAYBOOK_DATA
            )

            # Record metrics
            execution_time = time.time() - start_time
            self.metrics['response_times'].append(execution_time)
            self.metrics['request_count'] += 1

            # Validate performance
            assert execution_time < PERFORMANCE_THRESHOLD, f"Creation took {execution_time}s, exceeding {PERFORMANCE_THRESHOLD}s threshold"

            # Validate response
            assert response.status_code == 201
            playbook_data = response.json()
            
            # Validate schema compliance
            playbook = PlaybookResponseSchema(**playbook_data)
            assert playbook.name == TEST_PLAYBOOK_DATA["name"]
            assert playbook.status == PlaybookStatus.draft
            assert len(playbook.steps) == len(TEST_PLAYBOOK_DATA["steps"])

            # Validate audit trail
            db_playbook = db_session.query("playbook").filter_by(id=playbook.id).first()
            assert db_playbook.audit_log[-1]["type"] == "CREATE"
            assert "compliance_settings" in db_playbook.audit_log[-1]

            # Record success metric
            statsd.increment('test.playbook.create.success')

        except Exception as e:
            self.metrics['error_count'] += 1
            statsd.increment('test.playbook.create.error')
            raise

    @pytest.mark.caching
    def test_get_playbook(self, client: TestClient, db_session: Session):
        """Test playbook retrieval with caching validation."""
        # Create test playbook
        response = client.post(f"{API_PREFIX}/", json=TEST_PLAYBOOK_DATA)
        playbook_id = response.json()["id"]

        # First request (cache miss)
        start_time = time.time()
        response = client.get(f"{API_PREFIX}/{playbook_id}")
        first_request_time = time.time() - start_time

        # Validate initial response
        assert response.status_code == 200
        playbook_data = response.json()
        assert PlaybookResponseSchema(**playbook_data)

        # Second request (cache hit)
        start_time = time.time()
        cached_response = client.get(f"{API_PREFIX}/{playbook_id}")
        cached_request_time = time.time() - start_time

        # Validate cache performance
        assert cached_request_time < first_request_time
        assert cached_response.headers.get("X-Cache") == "HIT"

        # Record cache metrics
        statsd.histogram('test.playbook.get.cache_hit_time', cached_request_time)
        statsd.histogram('test.playbook.get.cache_miss_time', first_request_time)

    @pytest.mark.reliability
    def test_update_playbook(self, client: TestClient, db_session: Session):
        """Test playbook update with validation and error handling."""
        # Create initial playbook
        response = client.post(f"{API_PREFIX}/", json=TEST_PLAYBOOK_DATA)
        playbook_id = response.json()["id"]

        # Update data
        update_data = {
            **TEST_PLAYBOOK_DATA,
            "name": "Updated Onboarding Playbook",
            "steps": [
                *TEST_PLAYBOOK_DATA["steps"],
                {
                    "step_id": "follow_up",
                    "action_type": "notification",
                    "action_config": {
                        "type": "slack",
                        "parameters": {"channel": "cs-team"}
                    }
                }
            ]
        }

        try:
            # Perform update
            start_time = time.time()
            response = client.put(
                f"{API_PREFIX}/{playbook_id}",
                json=update_data
            )
            execution_time = time.time() - start_time

            # Validate performance
            assert execution_time < PERFORMANCE_THRESHOLD

            # Validate response
            assert response.status_code == 200
            updated_playbook = PlaybookResponseSchema(**response.json())
            assert updated_playbook.name == update_data["name"]
            assert len(updated_playbook.steps) == len(update_data["steps"])

            # Validate audit trail
            db_playbook = db_session.query("playbook").filter_by(id=playbook_id).first()
            assert db_playbook.audit_log[-1]["type"] == "UPDATE"
            assert "name" in db_playbook.audit_log[-1]["changes"]

            statsd.increment('test.playbook.update.success')

        except Exception as e:
            self.metrics['error_count'] += 1
            statsd.increment('test.playbook.update.error')
            raise

    @pytest.mark.compliance
    def test_delete_playbook(self, client: TestClient, db_session: Session):
        """Test playbook deletion with compliance validation."""
        # Create playbook to delete
        response = client.post(f"{API_PREFIX}/", json=TEST_PLAYBOOK_DATA)
        playbook_id = response.json()["id"]

        try:
            # Perform soft delete
            response = client.delete(f"{API_PREFIX}/{playbook_id}")
            assert response.status_code == 200

            # Validate soft delete
            db_playbook = db_session.query("playbook").filter_by(id=playbook_id).first()
            assert db_playbook.is_deleted
            assert not db_playbook.deleted_at  # Ensure data retention

            # Validate audit trail
            assert db_playbook.audit_log[-1]["type"] == "DELETE"
            assert "compliance" in db_playbook.audit_log[-1]

            statsd.increment('test.playbook.delete.success')

        except Exception as e:
            self.metrics['error_count'] += 1
            statsd.increment('test.playbook.delete.error')
            raise

    @pytest.mark.error_handling
    def test_invalid_playbook_creation(self, client: TestClient):
        """Test error handling for invalid playbook data."""
        invalid_data = {
            **TEST_PLAYBOOK_DATA,
            "steps": []  # Invalid: empty steps
        }

        response = client.post(f"{API_PREFIX}/", json=invalid_data)
        assert response.status_code == 422
        assert "validation_error" in response.json()

        statsd.increment('test.playbook.validation.error')