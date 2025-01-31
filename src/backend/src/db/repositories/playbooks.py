"""
Repository module implementing database operations for playbook management and execution tracking
with enhanced caching, validation, and audit support.

Version: SQLAlchemy 2.x
Redis 4.x
"""

import logging
import time
import uuid
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select, update
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import redis  # v4.x

from models.playbook import Playbook, PlaybookExecution, PlaybookStatus, PlaybookTriggerType
from db.session import get_db
from core.exceptions import BaseCustomException

# Configure module logger
logger = logging.getLogger(__name__)

# Cache configuration
CACHE_TTL = 300  # 5 minutes cache TTL
SLOW_QUERY_THRESHOLD = 1.0  # 1 second threshold for slow queries

class PlaybookRepository:
    """
    Repository class implementing database operations for playbook management 
    with caching and validation.
    """

    def __init__(self, db_session: Session, cache_client: redis.Redis):
        """Initialize repository with database session and cache client."""
        self._db = db_session
        self._cache = cache_client
        self._metrics = {
            'cache_hits': 0,
            'cache_misses': 0,
            'slow_queries': 0
        }

    def _get_cache_key(self, playbook_id: uuid.UUID) -> str:
        """Generate cache key for playbook."""
        return f"playbook:{str(playbook_id)}"

    def _log_performance(self, operation: str, duration: float) -> None:
        """Log performance metrics for monitoring."""
        if duration > SLOW_QUERY_THRESHOLD:
            self._metrics['slow_queries'] += 1
            logger.warning(
                f"Slow query detected",
                extra={
                    'operation': operation,
                    'duration': duration,
                    'metrics': self._metrics
                }
            )

    async def create_playbook(
        self,
        name: str,
        description: str,
        steps: Dict,
        trigger_type: PlaybookTriggerType,
        trigger_conditions: Dict
    ) -> Playbook:
        """
        Creates a new playbook template with validation.
        
        Args:
            name: Playbook name
            description: Playbook description
            steps: Playbook step configuration
            trigger_type: Type of trigger
            trigger_conditions: Trigger conditions
            
        Returns:
            Created playbook instance
            
        Raises:
            BaseCustomException: On validation or database errors
        """
        start_time = time.time()
        
        try:
            # Create new playbook instance with validation
            playbook = Playbook(
                name=name,
                description=description,
                steps=steps,
                trigger_type=trigger_type,
                trigger_conditions=trigger_conditions
            )
            
            # Validate steps and triggers
            playbook.validate_steps(steps)
            playbook.validate_triggers(trigger_conditions)
            
            # Add to database
            self._db.add(playbook)
            await self._db.commit()
            await self._db.refresh(playbook)
            
            # Invalidate cache
            cache_key = self._get_cache_key(playbook.id)
            await self._cache.delete(cache_key)
            
            duration = time.time() - start_time
            self._log_performance('create_playbook', duration)
            
            logger.info(
                f"Created playbook {playbook.id}",
                extra={
                    'playbook_id': str(playbook.id),
                    'duration': duration
                }
            )
            
            return playbook
            
        except SQLAlchemyError as e:
            await self._db.rollback()
            logger.error(f"Failed to create playbook: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to create playbook: {str(e)}",
                error_code="PLAY001"
            )

    async def get_playbook(self, playbook_id: uuid.UUID) -> Optional[Playbook]:
        """
        Retrieves playbook by ID with caching.
        
        Args:
            playbook_id: UUID of playbook to retrieve
            
        Returns:
            Found playbook or None
            
        Raises:
            BaseCustomException: On database errors
        """
        start_time = time.time()
        cache_key = self._get_cache_key(playbook_id)
        
        try:
            # Check cache first
            cached_playbook = await self._cache.get(cache_key)
            if cached_playbook:
                self._metrics['cache_hits'] += 1
                return Playbook.from_cache(cached_playbook)
                
            self._metrics['cache_misses'] += 1
            
            # Query database
            query = select(Playbook).where(
                Playbook.id == playbook_id,
                Playbook.is_deleted == False
            )
            playbook = (await self._db.execute(query)).scalar_one_or_none()
            
            if playbook:
                # Update cache
                await self._cache.setex(
                    cache_key,
                    CACHE_TTL,
                    playbook.to_cache()
                )
            
            duration = time.time() - start_time
            self._log_performance('get_playbook', duration)
            
            return playbook
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to retrieve playbook {playbook_id}: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to retrieve playbook: {str(e)}",
                error_code="PLAY002"
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
            
        Raises:
            BaseCustomException: On validation or database errors
        """
        start_time = time.time()
        
        try:
            # Get existing playbook
            playbook = await self.get_playbook(playbook_id)
            if not playbook:
                return None
                
            # Validate updates
            if 'steps' in updates:
                playbook.validate_steps(updates['steps'])
            if 'trigger_conditions' in updates:
                playbook.validate_triggers(updates['trigger_conditions'])
                
            # Apply updates
            for key, value in updates.items():
                setattr(playbook, key, value)
                
            await self._db.commit()
            await self._db.refresh(playbook)
            
            # Invalidate cache
            cache_key = self._get_cache_key(playbook_id)
            await self._cache.delete(cache_key)
            
            duration = time.time() - start_time
            self._log_performance('update_playbook', duration)
            
            return playbook
            
        except SQLAlchemyError as e:
            await self._db.rollback()
            logger.error(f"Failed to update playbook {playbook_id}: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to update playbook: {str(e)}",
                error_code="PLAY003"
            )

    async def delete_playbook(self, playbook_id: uuid.UUID) -> bool:
        """
        Soft deletes a playbook.
        
        Args:
            playbook_id: UUID of playbook to delete
            
        Returns:
            True if deleted, False if not found
            
        Raises:
            BaseCustomException: On database errors
        """
        start_time = time.time()
        
        try:
            # Soft delete
            result = await self._db.execute(
                update(Playbook)
                .where(Playbook.id == playbook_id)
                .values(is_deleted=True)
            )
            
            if result.rowcount == 0:
                return False
                
            await self._db.commit()
            
            # Invalidate cache
            cache_key = self._get_cache_key(playbook_id)
            await self._cache.delete(cache_key)
            
            duration = time.time() - start_time
            self._log_performance('delete_playbook', duration)
            
            return True
            
        except SQLAlchemyError as e:
            await self._db.rollback()
            logger.error(f"Failed to delete playbook {playbook_id}: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to delete playbook: {str(e)}",
                error_code="PLAY004"
            )

    async def list_playbooks(
        self,
        status: Optional[PlaybookStatus] = None,
        trigger_type: Optional[PlaybookTriggerType] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[Playbook], int]:
        """
        Lists playbooks with optional filtering and pagination.
        
        Args:
            status: Optional status filter
            trigger_type: Optional trigger type filter
            page: Page number
            page_size: Items per page
            
        Returns:
            Tuple of (playbooks list, total count)
            
        Raises:
            BaseCustomException: On database errors
        """
        start_time = time.time()
        
        try:
            # Build query
            query = select(Playbook).where(Playbook.is_deleted == False)
            
            if status:
                query = query.where(Playbook.status == status)
            if trigger_type:
                query = query.where(Playbook.trigger_type == trigger_type)
                
            # Add pagination
            offset = (page - 1) * page_size
            query = query.offset(offset).limit(page_size)
            
            # Execute query
            result = await self._db.execute(query)
            playbooks = result.scalars().all()
            
            # Get total count
            count_query = select(func.count()).select_from(Playbook).where(
                Playbook.is_deleted == False
            )
            if status:
                count_query = count_query.where(Playbook.status == status)
            if trigger_type:
                count_query = count_query.where(Playbook.trigger_type == trigger_type)
                
            total = await self._db.scalar(count_query)
            
            duration = time.time() - start_time
            self._log_performance('list_playbooks', duration)
            
            return playbooks, total
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to list playbooks: {str(e)}")
            raise BaseCustomException(
                message=f"Failed to list playbooks: {str(e)}",
                error_code="PLAY005"
            )