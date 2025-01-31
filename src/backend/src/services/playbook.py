"""
Service layer implementing business logic for customer success playbook management and execution.
Provides high-performance playbook operations with comprehensive validation and monitoring.

Version: Python 3.11+
Dependencies:
- structlog==23.1.0
"""

import structlog
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from models.playbook import (
    Playbook,
    PlaybookExecution,
    PlaybookStatus,
    PlaybookTriggerType
)
from db.repositories.playbooks import PlaybookRepository

# Configure structured logger
logger = structlog.get_logger(__name__)

# Constants for execution control
EXECUTION_TIMEOUT = 3600  # 1 hour timeout for playbook execution
MAX_RETRIES = 3  # Maximum retry attempts for failed steps

class PlaybookService:
    """
    Service class implementing business logic for playbook management and execution
    with performance optimization and comprehensive monitoring.
    """

    def __init__(self, repository: PlaybookRepository):
        """Initialize service with repository dependency."""
        self._repository = repository
        self._logger = logger.bind(service="PlaybookService")

    async def create_playbook(
        self,
        name: str,
        description: str,
        steps: Dict,
        trigger_type: PlaybookTriggerType,
        trigger_conditions: Dict
    ) -> Playbook:
        """
        Creates a new playbook with enhanced validation and monitoring.

        Args:
            name: Playbook name
            description: Playbook description
            steps: Playbook step configuration
            trigger_type: Type of trigger
            trigger_conditions: Trigger conditions

        Returns:
            Created playbook instance

        Raises:
            BaseCustomException: On validation or creation errors
        """
        self._logger.info(
            "Creating new playbook",
            name=name,
            trigger_type=trigger_type.value
        )

        # Validate step dependencies and execution order
        self._validate_step_dependencies(steps)
        
        # Create playbook via repository
        playbook = await self._repository.create_playbook(
            name=name,
            description=description,
            steps=steps,
            trigger_type=trigger_type,
            trigger_conditions=trigger_conditions
        )

        self._logger.info(
            "Playbook created successfully",
            playbook_id=str(playbook.id)
        )

        return playbook

    async def get_playbook(self, playbook_id: uuid.UUID) -> Optional[Playbook]:
        """
        Retrieves playbook by ID with caching.

        Args:
            playbook_id: UUID of playbook to retrieve

        Returns:
            Found playbook or None
        """
        return await self._repository.get_playbook(playbook_id)

    async def list_playbooks(
        self,
        status: Optional[PlaybookStatus] = None,
        trigger_type: Optional[PlaybookTriggerType] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[Playbook], int]:
        """
        Lists playbooks with filtering and pagination.

        Args:
            status: Optional status filter
            trigger_type: Optional trigger type filter
            page: Page number
            page_size: Items per page

        Returns:
            Tuple of (playbooks list, total count)
        """
        return await self._repository.list_playbooks(
            status=status,
            trigger_type=trigger_type,
            page=page,
            page_size=page_size
        )

    async def update_playbook(
        self,
        playbook_id: uuid.UUID,
        updates: Dict
    ) -> Optional[Playbook]:
        """
        Updates existing playbook with validation.

        Args:
            playbook_id: UUID of playbook to update
            updates: Dictionary of fields to update

        Returns:
            Updated playbook or None
        """
        if 'steps' in updates:
            self._validate_step_dependencies(updates['steps'])
        
        return await self._repository.update_playbook(
            playbook_id=playbook_id,
            updates=updates
        )

    async def execute_playbook(
        self,
        playbook_id: uuid.UUID,
        customer_id: uuid.UUID
    ) -> PlaybookExecution:
        """
        Executes playbook for a customer with comprehensive monitoring and error handling.

        Args:
            playbook_id: UUID of playbook to execute
            customer_id: UUID of target customer

        Returns:
            Execution instance with results

        Raises:
            BaseCustomException: On execution errors
        """
        start_time = datetime.utcnow()
        
        # Create execution instance
        execution = await self._repository.create_execution(
            playbook_id=playbook_id,
            customer_id=customer_id
        )

        try:
            # Get playbook
            playbook = await self.get_playbook(playbook_id)
            if not playbook or playbook.status != PlaybookStatus.active:
                raise ValueError("Playbook not found or not active")

            # Execute steps with retry logic
            results = await self._execute_steps(
                playbook.steps,
                customer_id,
                execution.id
            )

            # Update execution with results
            duration = (datetime.utcnow() - start_time).total_seconds()
            await self._repository.update_execution(
                execution_id=execution.id,
                status="completed",
                results=results,
                metrics={
                    "duration_seconds": duration,
                    "steps_completed": len(results),
                    "success_rate": self._calculate_success_rate(results)
                }
            )

            self._logger.info(
                "Playbook execution completed",
                execution_id=str(execution.id),
                duration=duration,
                success_rate=self._calculate_success_rate(results)
            )

            return execution

        except Exception as e:
            self._logger.error(
                "Playbook execution failed",
                execution_id=str(execution.id),
                error=str(e)
            )
            
            # Update execution with error status
            await self._repository.update_execution(
                execution_id=execution.id,
                status="failed",
                error_logs={"error": str(e)}
            )
            raise

    async def get_execution_status(
        self,
        execution_id: uuid.UUID
    ) -> Optional[PlaybookExecution]:
        """
        Retrieves execution status with detailed metrics.

        Args:
            execution_id: UUID of execution to check

        Returns:
            Execution instance with status or None
        """
        return await self._repository.get_execution(execution_id)

    def _validate_step_dependencies(self, steps: Dict) -> None:
        """
        Validates step dependencies and execution order.

        Args:
            steps: Step configuration to validate

        Raises:
            ValueError: On validation errors
        """
        if not steps.get('sequence'):
            raise ValueError("Step sequence is required")

        # Validate step dependencies
        dependencies = {}
        for step in steps['sequence']:
            step_id = step['id']
            deps = step.get('depends_on', [])
            
            # Check circular dependencies
            if step_id in deps:
                raise ValueError(f"Step {step_id} cannot depend on itself")
                
            dependencies[step_id] = deps

        # Check for circular dependencies in graph
        visited = set()
        temp_visited = set()

        def has_cycle(node: str) -> bool:
            if node in temp_visited:
                return True
            if node in visited:
                return False
                
            temp_visited.add(node)
            
            for dep in dependencies.get(node, []):
                if has_cycle(dep):
                    return True
                    
            temp_visited.remove(node)
            visited.add(node)
            return False

        for step_id in dependencies:
            if has_cycle(step_id):
                raise ValueError(f"Circular dependency detected in step {step_id}")

    async def _execute_steps(
        self,
        steps: Dict,
        customer_id: uuid.UUID,
        execution_id: uuid.UUID
    ) -> List[Dict]:
        """
        Executes playbook steps with retry logic and monitoring.

        Args:
            steps: Step configuration to execute
            customer_id: Target customer UUID
            execution_id: Execution tracking UUID

        Returns:
            List of step execution results
        """
        results = []
        retry_counts = {}

        for step in steps['sequence']:
            step_id = step['id']
            retry_count = 0

            while retry_count <= MAX_RETRIES:
                try:
                    # Execute step action
                    result = await self._execute_step_action(
                        step,
                        customer_id,
                        execution_id
                    )
                    
                    results.append({
                        'step_id': step_id,
                        'status': 'completed',
                        'result': result,
                        'retries': retry_count
                    })
                    break

                except Exception as e:
                    retry_count += 1
                    retry_counts[step_id] = retry_count
                    
                    if retry_count > MAX_RETRIES:
                        results.append({
                            'step_id': step_id,
                            'status': 'failed',
                            'error': str(e),
                            'retries': retry_count
                        })
                        
                        # Check error handling configuration
                        if step.get('error_handling', {}).get('fail_fast', False):
                            raise

        return results

    async def _execute_step_action(
        self,
        step: Dict,
        customer_id: uuid.UUID,
        execution_id: uuid.UUID
    ) -> Dict:
        """
        Executes individual step action with timeout handling.

        Args:
            step: Step configuration
            customer_id: Target customer UUID
            execution_id: Execution tracking UUID

        Returns:
            Step execution result
        """
        action_type = step['type']
        parameters = step.get('parameters', {})
        timeout = step.get('timeout', EXECUTION_TIMEOUT)

        # Execute action based on type
        if action_type == 'notification':
            return await self._execute_notification(parameters, customer_id)
        elif action_type == 'task_creation':
            return await self._execute_task_creation(parameters, customer_id)
        elif action_type == 'data_collection':
            return await self._execute_data_collection(parameters, customer_id)
        else:
            raise ValueError(f"Unsupported action type: {action_type}")

    def _calculate_success_rate(self, results: List[Dict]) -> float:
        """
        Calculates execution success rate from results.

        Args:
            results: List of step execution results

        Returns:
            Success rate as percentage
        """
        if not results:
            return 0.0
            
        successful_steps = sum(
            1 for result in results
            if result['status'] == 'completed'
        )
        return (successful_steps / len(results)) * 100