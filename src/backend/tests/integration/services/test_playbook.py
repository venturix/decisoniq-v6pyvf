"""
Integration tests for the PlaybookService class validating playbook management,
execution functionality, and performance requirements.

Version: pytest 7.x
"""

import asyncio
import pytest
import time
import uuid
from typing import Dict, List, Optional
from datetime import datetime, timedelta

from services.playbook import PlaybookService
from models.playbook import PlaybookStatus, PlaybookTriggerType
from db.repositories.playbooks import PlaybookRepository
from db.session import DatabaseSession
from core.exceptions import BaseCustomException

# Test constants
PERFORMANCE_THRESHOLD_MS = 3000  # 3 second performance requirement
CONCURRENT_EXECUTIONS = 5  # Number of concurrent executions to test

# Sample test data
SAMPLE_PLAYBOOK_DATA = {
    "name": "Risk Mitigation Playbook",
    "description": "Automated intervention for high-risk customers",
    "steps": {
        "sequence": [
            {
                "id": "notify_csm",
                "type": "notification",
                "parameters": {
                    "template": "risk_alert",
                    "channel": "email"
                },
                "timeout": 300
            },
            {
                "id": "create_task",
                "type": "task_creation",
                "parameters": {
                    "title": "Review Risk Factors",
                    "priority": "high"
                },
                "depends_on": ["notify_csm"],
                "timeout": 300
            }
        ],
        "actions": [
            {
                "type": "notification",
                "parameters": {"template": "risk_alert"},
                "timeout": 300
            },
            {
                "type": "task_creation",
                "parameters": {"priority": "high"},
                "timeout": 300
            }
        ],
        "error_handling": {
            "retry_count": 3,
            "fail_fast": False
        }
    },
    "trigger_type": PlaybookTriggerType.risk_score,
    "trigger_conditions": {
        "threshold": 80,
        "priority": "high"
    }
}

@pytest.mark.integration
class TestPlaybookServiceIntegration:
    """Integration test suite for PlaybookService with performance validation."""

    @pytest.fixture(autouse=True)
    async def setup(self, db_session):
        """Setup test environment before each test."""
        self.db_session = db_session
        self.repository = PlaybookRepository(db_session, cache_client=None)
        self.service = PlaybookService(self.repository)
        
        # Clean up test data after each test
        yield
        await self.cleanup_test_data()

    async def cleanup_test_data(self):
        """Clean up test data after tests."""
        try:
            # Soft delete test playbooks
            query = "UPDATE playbook SET is_deleted = true WHERE name LIKE 'Test%'"
            await self.db_session.execute(query)
            await self.db_session.commit()
        except Exception as e:
            await self.db_session.rollback()
            pytest.fail(f"Failed to cleanup test data: {str(e)}")

    @pytest.mark.asyncio
    async def test_create_playbook_performance(self):
        """Test playbook creation with performance validation."""
        start_time = time.time()

        try:
            # Create playbook
            playbook = await self.service.create_playbook(
                name=SAMPLE_PLAYBOOK_DATA["name"],
                description=SAMPLE_PLAYBOOK_DATA["description"],
                steps=SAMPLE_PLAYBOOK_DATA["steps"],
                trigger_type=SAMPLE_PLAYBOOK_DATA["trigger_type"],
                trigger_conditions=SAMPLE_PLAYBOOK_DATA["trigger_conditions"]
            )

            # Validate performance
            duration_ms = (time.time() - start_time) * 1000
            assert duration_ms < PERFORMANCE_THRESHOLD_MS, \
                f"Playbook creation took {duration_ms}ms, exceeding {PERFORMANCE_THRESHOLD_MS}ms threshold"

            # Validate created playbook
            assert playbook.id is not None
            assert playbook.name == SAMPLE_PLAYBOOK_DATA["name"]
            assert playbook.status == PlaybookStatus.draft
            assert playbook.trigger_type == SAMPLE_PLAYBOOK_DATA["trigger_type"]
            assert playbook.steps == SAMPLE_PLAYBOOK_DATA["steps"]
            assert playbook.trigger_conditions == SAMPLE_PLAYBOOK_DATA["trigger_conditions"]

        except Exception as e:
            pytest.fail(f"Playbook creation failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_concurrent_execution(self):
        """Test concurrent playbook executions for race conditions."""
        # Create test playbook
        playbook = await self.service.create_playbook(
            name=SAMPLE_PLAYBOOK_DATA["name"],
            description=SAMPLE_PLAYBOOK_DATA["description"],
            steps=SAMPLE_PLAYBOOK_DATA["steps"],
            trigger_type=SAMPLE_PLAYBOOK_DATA["trigger_type"],
            trigger_conditions=SAMPLE_PLAYBOOK_DATA["trigger_conditions"]
        )

        # Generate test customer IDs
        customer_ids = [uuid.uuid4() for _ in range(CONCURRENT_EXECUTIONS)]
        
        # Track execution times
        start_time = time.time()

        try:
            # Launch concurrent executions
            tasks = [
                self.service.execute_playbook(playbook.id, customer_id)
                for customer_id in customer_ids
            ]
            executions = await asyncio.gather(*tasks)

            # Validate performance
            duration_ms = (time.time() - start_time) * 1000
            assert duration_ms < PERFORMANCE_THRESHOLD_MS, \
                f"Concurrent executions took {duration_ms}ms, exceeding {PERFORMANCE_THRESHOLD_MS}ms threshold"

            # Validate executions
            for execution in executions:
                assert execution.playbook_id == playbook.id
                assert execution.status in ["completed", "failed"]
                assert execution.started_at is not None
                assert execution.execution_metrics is not None

            # Check for race conditions
            execution_ids = set(e.id for e in executions)
            assert len(execution_ids) == CONCURRENT_EXECUTIONS, \
                "Duplicate execution IDs detected"

        except Exception as e:
            pytest.fail(f"Concurrent execution test failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_playbook_execution_monitoring(self):
        """Test execution monitoring and performance metrics."""
        # Create test playbook
        playbook = await self.service.create_playbook(
            name=SAMPLE_PLAYBOOK_DATA["name"],
            description=SAMPLE_PLAYBOOK_DATA["description"],
            steps=SAMPLE_PLAYBOOK_DATA["steps"],
            trigger_type=SAMPLE_PLAYBOOK_DATA["trigger_type"],
            trigger_conditions=SAMPLE_PLAYBOOK_DATA["trigger_conditions"]
        )

        try:
            # Execute playbook
            customer_id = uuid.uuid4()
            execution = await self.service.execute_playbook(playbook.id, customer_id)

            # Monitor execution
            status = await self.service.get_execution_status(execution.id)
            
            # Validate monitoring data
            assert status is not None
            assert status.execution_metrics is not None
            assert "duration_ms" in status.execution_metrics
            assert "step_metrics" in status.execution_metrics
            assert status.execution_metrics["duration_ms"] < PERFORMANCE_THRESHOLD_MS

            # Validate step completion
            for step in SAMPLE_PLAYBOOK_DATA["steps"]["sequence"]:
                step_id = step["id"]
                assert step_id in status.results
                assert status.results[step_id]["status"] in ["completed", "failed"]

        except Exception as e:
            pytest.fail(f"Execution monitoring test failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_error_handling_and_retry(self):
        """Test error handling and retry mechanisms."""
        # Create test playbook with intentional error
        error_playbook_data = SAMPLE_PLAYBOOK_DATA.copy()
        error_playbook_data["steps"]["sequence"][0]["parameters"]["invalid"] = True

        try:
            # Create playbook
            playbook = await self.service.create_playbook(
                name=error_playbook_data["name"],
                description=error_playbook_data["description"],
                steps=error_playbook_data["steps"],
                trigger_type=error_playbook_data["trigger_type"],
                trigger_conditions=error_playbook_data["trigger_conditions"]
            )

            # Execute playbook
            customer_id = uuid.uuid4()
            execution = await self.service.execute_playbook(playbook.id, customer_id)

            # Validate error handling
            status = await self.service.get_execution_status(execution.id)
            assert status.status == "failed"
            assert status.error_logs is not None
            assert len(status.error_logs) > 0

            # Verify retry attempts
            assert status.execution_metrics["retry_count"] <= 3

        except Exception as e:
            pytest.fail(f"Error handling test failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_playbook_list_pagination(self):
        """Test playbook listing with pagination and filtering."""
        # Create multiple test playbooks
        playbooks_to_create = 15
        created_playbooks = []

        try:
            for i in range(playbooks_to_create):
                data = SAMPLE_PLAYBOOK_DATA.copy()
                data["name"] = f"Test Playbook {i}"
                playbook = await self.service.create_playbook(
                    name=data["name"],
                    description=data["description"],
                    steps=data["steps"],
                    trigger_type=data["trigger_type"],
                    trigger_conditions=data["trigger_conditions"]
                )
                created_playbooks.append(playbook)

            # Test pagination
            page_size = 5
            playbooks, total = await self.service.list_playbooks(
                status=PlaybookStatus.draft,
                page=1,
                page_size=page_size
            )

            # Validate pagination results
            assert len(playbooks) == page_size
            assert total >= playbooks_to_create
            assert all(p.status == PlaybookStatus.draft for p in playbooks)

        except Exception as e:
            pytest.fail(f"Pagination test failed: {str(e)}")