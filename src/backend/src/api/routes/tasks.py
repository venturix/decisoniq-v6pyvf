"""
FastAPI route handlers for task management in the Customer Success AI Platform.
Provides high-performance endpoints with comprehensive error handling,
caching, and monitoring capabilities.

Version: FastAPI 0.100+
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_cache.decorator import cache
from opentelemetry import trace

from services.task import TaskService
from schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskStatusUpdate
)
from core.exceptions import BaseCustomException
from core.telemetry import track_timing, track_metric

# Initialize router with prefix and tags
router = APIRouter(prefix="/tasks", tags=["tasks"])

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Constants
CACHE_TTL = 300  # 5 minutes cache TTL
RATE_LIMIT = "100/minute"

async def get_task_service() -> TaskService:
    """Dependency injection for TaskService with telemetry tracking."""
    with tracer.start_as_current_span("get_task_service") as span:
        try:
            service = TaskService()
            span.set_attribute("service_initialized", True)
            return service
        except Exception as e:
            span.set_attribute("error", True)
            span.set_attribute("error.message", str(e))
            raise BaseCustomException(
                message="Failed to initialize task service",
                error_code="TASK_SERVICE_ERROR"
            )

@router.post("/", response_model=TaskResponse, status_code=201)
@track_timing("task.create", sla_monitoring=True)
async def create_task(
    task_data: TaskCreate,
    task_service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """
    Creates a new customer success task with validation and monitoring.
    
    Args:
        task_data: Task creation parameters
        task_service: Injected task service
        
    Returns:
        TaskResponse: Created task details
        
    Raises:
        HTTPException: On validation or creation errors
    """
    try:
        with tracer.start_as_current_span("create_task") as span:
            span.set_attribute("customer_id", str(task_data.customer_id))
            
            task = await task_service.create_customer_task(
                title=task_data.title,
                description=task_data.description,
                customer_id=task_data.customer_id,
                task_type=task_data.task_type,
                assignee_id=task_data.assignee_id,
                priority=task_data.priority,
                due_date=task_data.due_date,
                metadata=task_data.metadata
            )
            
            track_metric(
                "task.created",
                1,
                tags={
                    "task_type": task_data.task_type.value,
                    "priority": task_data.priority.value
                }
            )
            
            return TaskResponse.from_orm(task)
            
    except Exception as e:
        track_metric("task.creation.error", 1)
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

@router.get("/{task_id}", response_model=TaskResponse)
@cache(expire=CACHE_TTL)
@track_timing("task.get")
async def get_task(
    task_id: UUID,
    task_service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """
    Retrieves task details with caching and monitoring.
    
    Args:
        task_id: Task UUID
        task_service: Injected task service
        
    Returns:
        TaskResponse: Task details
        
    Raises:
        HTTPException: If task not found or retrieval fails
    """
    try:
        with tracer.start_as_current_span("get_task") as span:
            span.set_attribute("task_id", str(task_id))
            
            task = await task_service.get_task_details(task_id)
            if not task:
                raise HTTPException(
                    status_code=404,
                    detail="Task not found"
                )
                
            return TaskResponse.from_orm(task)
            
    except HTTPException:
        raise
    except Exception as e:
        track_metric("task.retrieval.error", 1)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve task: {str(e)}"
        )

@router.patch("/{task_id}", response_model=TaskResponse)
@track_timing("task.update")
async def update_task(
    task_id: UUID,
    task_update: TaskUpdate,
    task_service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """
    Updates task details with validation and monitoring.
    
    Args:
        task_id: Task UUID
        task_update: Update parameters
        task_service: Injected task service
        
    Returns:
        TaskResponse: Updated task details
        
    Raises:
        HTTPException: On validation or update errors
    """
    try:
        with tracer.start_as_current_span("update_task") as span:
            span.set_attribute("task_id", str(task_id))
            
            task = await task_service.update_task(
                task_id=task_id,
                update_data=task_update.dict(exclude_unset=True)
            )
            
            track_metric("task.updated", 1)
            return TaskResponse.from_orm(task)
            
    except Exception as e:
        track_metric("task.update.error", 1)
        raise HTTPException(
            status_code=400,
            detail=f"Failed to update task: {str(e)}"
        )

@router.put("/{task_id}/status", response_model=TaskResponse)
@track_timing("task.status_update")
async def update_task_status(
    task_id: UUID,
    status_update: TaskStatusUpdate,
    task_service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """
    Updates task status with validation and monitoring.
    
    Args:
        task_id: Task UUID
        status_update: Status update parameters
        task_service: Injected task service
        
    Returns:
        TaskResponse: Updated task details
        
    Raises:
        HTTPException: On validation or update errors
    """
    try:
        with tracer.start_as_current_span("update_task_status") as span:
            span.set_attribute("task_id", str(task_id))
            span.set_attribute("new_status", status_update.status.value)
            
            task = await task_service.update_task_status(
                task_id=task_id,
                status=status_update.status,
                status_reason=status_update.status_reason,
                status_metadata=status_update.status_metadata
            )
            
            track_metric(
                "task.status_updated",
                1,
                tags={"new_status": status_update.status.value}
            )
            return TaskResponse.from_orm(task)
            
    except Exception as e:
        track_metric("task.status_update.error", 1)
        raise HTTPException(
            status_code=400,
            detail=f"Failed to update task status: {str(e)}"
        )

@router.get("/customer/{customer_id}", response_model=List[TaskResponse])
@cache(expire=CACHE_TTL)
@track_timing("task.list_customer")
async def get_customer_tasks(
    customer_id: UUID,
    status: Optional[str] = Query(None, description="Filter by task status"),
    priority: Optional[str] = Query(None, description="Filter by task priority"),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    task_service: TaskService = Depends(get_task_service)
) -> List[TaskResponse]:
    """
    Retrieves tasks for a customer with filtering and pagination.
    
    Args:
        customer_id: Customer UUID
        status: Optional status filter
        priority: Optional priority filter
        limit: Maximum number of tasks to return
        offset: Number of tasks to skip
        task_service: Injected task service
        
    Returns:
        List[TaskResponse]: List of customer tasks
        
    Raises:
        HTTPException: On retrieval errors
    """
    try:
        with tracer.start_as_current_span("get_customer_tasks") as span:
            span.set_attribute("customer_id", str(customer_id))
            span.set_attribute("limit", limit)
            span.set_attribute("offset", offset)
            
            filters = {
                "customer_id": customer_id,
                "status": status,
                "priority": priority
            }
            
            tasks = await task_service.get_customer_tasks(
                filters=filters,
                limit=limit,
                offset=offset
            )
            
            track_metric(
                "task.customer_tasks_retrieved",
                len(tasks),
                tags={"customer_id": str(customer_id)}
            )
            return [TaskResponse.from_orm(task) for task in tasks]
            
    except Exception as e:
        track_metric("task.customer_tasks.error", 1)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve customer tasks: {str(e)}"
        )