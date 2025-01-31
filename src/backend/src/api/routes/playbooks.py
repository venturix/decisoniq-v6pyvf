"""
FastAPI router implementation for playbook management and execution endpoints.
Provides secure, high-performance API endpoints with comprehensive validation,
caching, and monitoring capabilities.

Version: FastAPI 0.100.0
Dependencies:
- structlog==23.1.0
"""

import structlog
import uuid
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from services.playbook import PlaybookService
from schemas.playbook import (
    PlaybookCreateSchema,
    PlaybookResponseSchema,
    PlaybookExecutionSchema
)
from models.playbook import PlaybookStatus, PlaybookTriggerType
from core.exceptions import BaseCustomException
from db.session import get_db
from core.auth import get_current_user, PermissionChecker
from core.monitoring import metrics, cache

# Configure structured logger
logger = structlog.get_logger(__name__)

# Initialize router with prefix and tags
router = APIRouter(
    prefix="/api/v1/playbooks",
    tags=["playbooks"]
)

# Cache configuration
CACHE_TTL = 300  # 5 minutes cache TTL

@router.post("/", response_model=PlaybookResponseSchema)
async def create_playbook(
    playbook_data: PlaybookCreateSchema,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(["create_playbook"]))
) -> PlaybookResponseSchema:
    """
    Creates a new playbook with comprehensive validation and monitoring.

    Args:
        playbook_data: Validated playbook creation data
        db: Database session
        current_user: Authenticated user info

    Returns:
        Created playbook data

    Raises:
        HTTPException: On validation or creation errors
    """
    try:
        logger.info(
            "Creating new playbook",
            user_id=current_user["id"],
            playbook_name=playbook_data.name
        )

        service = PlaybookService(db)
        playbook = await service.create_playbook(
            name=playbook_data.name,
            description=playbook_data.description,
            steps=playbook_data.steps,
            trigger_type=playbook_data.trigger_type,
            trigger_conditions=playbook_data.trigger_conditions
        )

        metrics.increment("playbook.created")
        return PlaybookResponseSchema.from_orm(playbook)

    except BaseCustomException as e:
        logger.error(
            "Playbook creation failed",
            error=str(e),
            user_id=current_user["id"]
        )
        raise HTTPException(status_code=e.status_code, detail=str(e))

@router.get("/{playbook_id}", response_model=PlaybookResponseSchema)
async def get_playbook(
    playbook_id: uuid.UUID,
    response: Response,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(["view_playbook"]))
) -> PlaybookResponseSchema:
    """
    Retrieves playbook by ID with caching support.

    Args:
        playbook_id: UUID of playbook to retrieve
        response: FastAPI response object
        db: Database session
        current_user: Authenticated user info

    Returns:
        Playbook data if found

    Raises:
        HTTPException: If playbook not found or on errors
    """
    cache_key = f"playbook:{playbook_id}"
    
    # Try cache first
    if cached := await cache.get(cache_key):
        metrics.increment("playbook.cache.hit")
        return PlaybookResponseSchema.parse_raw(cached)

    metrics.increment("playbook.cache.miss")
    
    try:
        service = PlaybookService(db)
        playbook = await service.get_playbook(playbook_id)
        
        if not playbook:
            raise HTTPException(status_code=404, detail="Playbook not found")

        # Cache successful response
        response_data = PlaybookResponseSchema.from_orm(playbook)
        await cache.set(cache_key, response_data.json(), ttl=CACHE_TTL)
        
        return response_data

    except BaseCustomException as e:
        logger.error(
            "Failed to retrieve playbook",
            playbook_id=str(playbook_id),
            error=str(e)
        )
        raise HTTPException(status_code=e.status_code, detail=str(e))

@router.get("/", response_model=List[PlaybookResponseSchema])
async def list_playbooks(
    status: Optional[PlaybookStatus] = None,
    trigger_type: Optional[PlaybookTriggerType] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(["list_playbooks"]))
) -> List[PlaybookResponseSchema]:
    """
    Lists playbooks with filtering and pagination.

    Args:
        status: Optional status filter
        trigger_type: Optional trigger type filter
        page: Page number
        page_size: Items per page
        db: Database session
        current_user: Authenticated user info

    Returns:
        List of playbooks matching criteria

    Raises:
        HTTPException: On query errors
    """
    try:
        service = PlaybookService(db)
        playbooks, total = await service.list_playbooks(
            status=status,
            trigger_type=trigger_type,
            page=page,
            page_size=page_size
        )

        # Set pagination headers
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page"] = str(page)
        response.headers["X-Page-Size"] = str(page_size)

        return [PlaybookResponseSchema.from_orm(p) for p in playbooks]

    except BaseCustomException as e:
        logger.error(
            "Failed to list playbooks",
            error=str(e),
            filters={"status": status, "trigger_type": trigger_type}
        )
        raise HTTPException(status_code=e.status_code, detail=str(e))

@router.post("/{playbook_id}/execute", response_model=PlaybookExecutionSchema)
async def execute_playbook(
    playbook_id: uuid.UUID,
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(["execute_playbook"]))
) -> PlaybookExecutionSchema:
    """
    Executes playbook for a customer with comprehensive monitoring.

    Args:
        playbook_id: UUID of playbook to execute
        customer_id: UUID of target customer
        db: Database session
        current_user: Authenticated user info

    Returns:
        Execution tracking data

    Raises:
        HTTPException: On execution errors
    """
    try:
        logger.info(
            "Executing playbook",
            playbook_id=str(playbook_id),
            customer_id=str(customer_id),
            user_id=current_user["id"]
        )

        service = PlaybookService(db)
        execution = await service.execute_playbook(
            playbook_id=playbook_id,
            customer_id=customer_id
        )

        metrics.increment("playbook.executed")
        return PlaybookExecutionSchema.from_orm(execution)

    except BaseCustomException as e:
        logger.error(
            "Playbook execution failed",
            playbook_id=str(playbook_id),
            customer_id=str(customer_id),
            error=str(e)
        )
        raise HTTPException(status_code=e.status_code, detail=str(e))

@router.get("/executions/{execution_id}", response_model=PlaybookExecutionSchema)
async def get_execution_status(
    execution_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(["view_execution"]))
) -> PlaybookExecutionSchema:
    """
    Retrieves execution status with detailed metrics.

    Args:
        execution_id: UUID of execution to check
        db: Database session
        current_user: Authenticated user info

    Returns:
        Execution status and metrics

    Raises:
        HTTPException: If execution not found or on errors
    """
    try:
        service = PlaybookService(db)
        execution = await service.get_execution_status(execution_id)

        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        return PlaybookExecutionSchema.from_orm(execution)

    except BaseCustomException as e:
        logger.error(
            "Failed to retrieve execution status",
            execution_id=str(execution_id),
            error=str(e)
        )
        raise HTTPException(status_code=e.status_code, detail=str(e))