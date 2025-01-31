"""
Integration tests for task management API endpoints in the Customer Success AI Platform.
Validates task lifecycle, performance, and data integrity requirements.

Dependencies:
- pytest==7.x
- freezegun==1.2+
"""

import uuid
import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any

import pytest
from freezegun import freeze_time

from models.task import TaskStatus, TaskPriority, TaskType
from schemas.task import TaskCreate, TaskUpdate, TaskStatusUpdate, TaskResponse

# API endpoint constants
BASE_URL = '/api/v1/tasks'
PERFORMANCE_THRESHOLD = 3.0  # 3 second SLA requirement

class TaskFactory:
    """Factory class for generating test task data with relationships."""

    def __init__(self):
        """Initialize task factory with test data templates."""
        self.customer_id = uuid.uuid4()
        self.assignee_id = uuid.uuid4()
        self.default_task_data = {
            'title': 'Test Task',
            'description': 'Integration test task description',
            'customer_id': self.customer_id,
            'assignee_id': self.assignee_id,
            'task_type': TaskType.manual.value,
            'priority': TaskPriority.high.value,
            'due_date': (datetime.utcnow() + timedelta(days=7)).isoformat(),
            'metadata': {
                'source': 'integration_test',
                'test_run_id': str(uuid.uuid4())
            }
        }

    def create_test_task(self, custom_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Creates test task data with optional customization."""
        task_data = self.default_task_data.copy()
        if custom_data:
            task_data.update(custom_data)
        return task_data

@pytest.fixture
def task_factory():
    """Provides TaskFactory instance for test data generation."""
    return TaskFactory()

@pytest.mark.integration
@pytest.mark.performance
async def test_create_task(client, db_session, task_factory):
    """Test task creation with performance validation."""
    # Prepare test data
    task_data = task_factory.create_test_task()
    
    # Measure request performance
    start_time = time.time()
    response = await client.post(
        BASE_URL,
        json=task_data
    )
    response_time = time.time() - start_time
    
    # Validate performance
    assert response_time < PERFORMANCE_THRESHOLD, f"Task creation exceeded {PERFORMANCE_THRESHOLD}s SLA"
    
    # Validate response
    assert response.status_code == 201
    task_response = TaskResponse(**response.json())
    
    # Validate created task data
    assert task_response.title == task_data['title']
    assert task_response.customer_id == task_data['customer_id']
    assert task_response.assignee_id == task_data['assignee_id']
    assert task_response.status == TaskStatus.pending
    assert task_response.metadata['source'] == 'integration_test'

@pytest.mark.integration
@pytest.mark.performance
async def test_get_task(client, db_session, task_factory):
    """Test task retrieval with performance validation."""
    # Create test task
    task_data = task_factory.create_test_task()
    create_response = await client.post(BASE_URL, json=task_data)
    task_id = create_response.json()['id']
    
    # Measure retrieval performance
    start_time = time.time()
    response = await client.get(f"{BASE_URL}/{task_id}")
    response_time = time.time() - start_time
    
    # Validate performance
    assert response_time < PERFORMANCE_THRESHOLD, f"Task retrieval exceeded {PERFORMANCE_THRESHOLD}s SLA"
    
    # Validate response
    assert response.status_code == 200
    task_response = TaskResponse(**response.json())
    assert task_response.id == task_id

@pytest.mark.integration
async def test_update_task(client, db_session, task_factory):
    """Test task update functionality."""
    # Create test task
    task_data = task_factory.create_test_task()
    create_response = await client.post(BASE_URL, json=task_data)
    task_id = create_response.json()['id']
    
    # Update task
    update_data = {
        'title': 'Updated Task Title',
        'priority': TaskPriority.urgent.value
    }
    response = await client.patch(
        f"{BASE_URL}/{task_id}",
        json=update_data
    )
    
    # Validate response
    assert response.status_code == 200
    task_response = TaskResponse(**response.json())
    assert task_response.title == update_data['title']
    assert task_response.priority == TaskPriority.urgent

@pytest.mark.integration
async def test_update_task_status(client, db_session, task_factory):
    """Test task status update with validation."""
    # Create test task
    task_data = task_factory.create_test_task()
    create_response = await client.post(BASE_URL, json=task_data)
    task_id = create_response.json()['id']
    
    # Update status
    status_update = {
        'status': TaskStatus.in_progress.value,
        'status_reason': 'Starting task execution',
        'status_metadata': {'executor': 'test_user'}
    }
    response = await client.patch(
        f"{BASE_URL}/{task_id}/status",
        json=status_update
    )
    
    # Validate response
    assert response.status_code == 200
    task_response = TaskResponse(**response.json())
    assert task_response.status == TaskStatus.in_progress

@pytest.mark.integration
@pytest.mark.performance
async def test_list_tasks(client, db_session, task_factory):
    """Test task listing with filtering and performance validation."""
    # Create multiple test tasks
    tasks = []
    for _ in range(3):
        task_data = task_factory.create_test_task()
        response = await client.post(BASE_URL, json=task_data)
        tasks.append(response.json())
    
    # Measure list performance
    start_time = time.time()
    response = await client.get(
        BASE_URL,
        params={'customer_id': str(task_factory.customer_id)}
    )
    response_time = time.time() - start_time
    
    # Validate performance
    assert response_time < PERFORMANCE_THRESHOLD, f"Task listing exceeded {PERFORMANCE_THRESHOLD}s SLA"
    
    # Validate response
    assert response.status_code == 200
    task_list = response.json()
    assert len(task_list) >= 3
    
    # Validate filtering
    for task in task_list:
        assert task['customer_id'] == str(task_factory.customer_id)

@pytest.mark.integration
async def test_delete_task(client, db_session, task_factory):
    """Test task deletion with validation."""
    # Create test task
    task_data = task_factory.create_test_task()
    create_response = await client.post(BASE_URL, json=task_data)
    task_id = create_response.json()['id']
    
    # Delete task
    response = await client.delete(f"{BASE_URL}/{task_id}")
    assert response.status_code == 204
    
    # Verify deletion
    get_response = await client.get(f"{BASE_URL}/{task_id}")
    assert get_response.status_code == 404

@pytest.mark.integration
async def test_invalid_task_creation(client, db_session, task_factory):
    """Test task creation validation rules."""
    # Test with invalid data
    invalid_task = task_factory.create_test_task()
    invalid_task['due_date'] = datetime.utcnow().isoformat()  # Past due date
    
    response = await client.post(BASE_URL, json=invalid_task)
    assert response.status_code == 422
    
    # Validate error response
    error_detail = response.json()['detail']
    assert 'due_date' in str(error_detail)

@pytest.mark.integration
async def test_invalid_status_transition(client, db_session, task_factory):
    """Test task status transition validation."""
    # Create test task
    task_data = task_factory.create_test_task()
    create_response = await client.post(BASE_URL, json=task_data)
    task_id = create_response.json()['id']
    
    # Attempt invalid transition
    invalid_status = {
        'status': TaskStatus.completed.value,
        'status_reason': 'Invalid transition'
    }
    response = await client.patch(
        f"{BASE_URL}/{task_id}/status",
        json=invalid_status
    )
    
    # Validate error response
    assert response.status_code == 422
    error_detail = response.json()['detail']
    assert 'status transition' in str(error_detail)