"""
Core event system implementation for Customer Success AI Platform.
Provides enterprise-grade event handling with comprehensive telemetry integration.

Dependencies:
- asyncio==3.11+
- datadog==0.44.0
"""

import asyncio
import uuid
from datetime import datetime
from typing import Dict, List, Any, Callable, Optional, Union
from dataclasses import dataclass, asdict

from core.logging import StructuredLogger
from core.telemetry import track_metric, start_trace, end_trace

# Initialize module logger
logger = StructuredLogger(__name__)

# Global event handler registry
EVENT_HANDLERS: Dict[str, List[Callable]] = {}

# Event processing configuration
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1.0
EVENT_BATCH_SIZE = 100
MAX_QUEUE_SIZE = 10000

@dataclass
class Event:
    """Base event class with comprehensive telemetry integration."""
    
    type: str
    data: Dict[str, Any]
    timestamp: datetime = None
    correlation_id: str = None
    telemetry_context: Dict[str, Any] = None

    def __post_init__(self):
        """Initialize event metadata and telemetry context."""
        self.timestamp = self.timestamp or datetime.utcnow()
        self.correlation_id = self.correlation_id or str(uuid.uuid4())
        self.telemetry_context = self.telemetry_context or {
            'event_id': str(uuid.uuid4()),
            'timestamp': self.timestamp.isoformat(),
            'correlation_id': self.correlation_id,
            'environment': 'production'
        }
        
        # Record event creation metric
        track_metric(
            'events.created',
            1,
            tags={
                'event_type': self.type,
                'correlation_id': self.correlation_id
            }
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary format with telemetry data."""
        return {
            'type': self.type,
            'data': self.data,
            'timestamp': self.timestamp.isoformat(),
            'correlation_id': self.correlation_id,
            'telemetry_context': self.telemetry_context
        }

class EventBus:
    """Central event bus with monitoring and reliability features."""
    
    def __init__(self):
        """Initialize event bus with bounded queue and monitoring."""
        self._handlers = EVENT_HANDLERS
        self._event_queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)
        self._metrics = {
            'processed': 0,
            'failed': 0,
            'retried': 0
        }
        
        # Start event processor
        asyncio.create_task(self.process_events())

    async def process_events(self) -> None:
        """Process events from queue with comprehensive monitoring."""
        while True:
            try:
                # Process events in batches
                events = []
                for _ in range(EVENT_BATCH_SIZE):
                    try:
                        event = await self._event_queue.get()
                        events.append(event)
                    except asyncio.QueueEmpty:
                        break

                if not events:
                    await asyncio.sleep(0.1)
                    continue

                # Start batch processing trace
                trace_id = start_trace('event_batch_processing')

                for event in events:
                    try:
                        handlers = self._handlers.get(event.type, [])
                        for handler in handlers:
                            for attempt in range(MAX_RETRY_ATTEMPTS):
                                try:
                                    await handler(event)
                                    self._metrics['processed'] += 1
                                    break
                                except Exception as e:
                                    if attempt == MAX_RETRY_ATTEMPTS - 1:
                                        logger.log('error', 
                                            f"Handler failed after {MAX_RETRY_ATTEMPTS} attempts",
                                            extra={
                                                'event_type': event.type,
                                                'correlation_id': event.correlation_id,
                                                'error': str(e)
                                            }
                                        )
                                        self._metrics['failed'] += 1
                                    else:
                                        self._metrics['retried'] += 1
                                        await asyncio.sleep(RETRY_DELAY_SECONDS * (attempt + 1))

                    finally:
                        self._event_queue.task_done()

                # Record batch metrics
                track_metric(
                    'events.batch_processed',
                    len(events),
                    tags={'trace_id': trace_id}
                )

                # End batch trace
                end_trace(trace_id)

            except Exception as e:
                logger.log('error', f"Event processor error: {str(e)}")
                await asyncio.sleep(1)

async def emit_event(
    event_type: str,
    event_data: Dict[str, Any],
    async_execution: bool = True,
    correlation_id: Optional[str] = None
) -> Union[None, List[Any]]:
    """Emit event to registered handlers with telemetry tracking."""
    
    # Create event instance
    event = Event(
        type=event_type,
        data=event_data,
        correlation_id=correlation_id
    )

    # Start event processing trace
    trace_id = start_trace('event_emission')
    
    try:
        # Log event emission
        logger.log('info', f"Emitting event: {event_type}",
            extra={
                'correlation_id': event.correlation_id,
                'event_data': event_data
            }
        )

        # Get registered handlers
        handlers = EVENT_HANDLERS.get(event_type, [])
        if not handlers:
            logger.log('warning', f"No handlers registered for event type: {event_type}")
            return None

        # Record event submission
        track_metric(
            'events.emitted',
            1,
            tags={
                'event_type': event_type,
                'handler_count': len(handlers)
            }
        )

        if async_execution:
            # Add to processing queue
            await _event_bus._event_queue.put(event)
            return None
        else:
            # Execute handlers synchronously
            results = []
            for handler in handlers:
                try:
                    result = await handler(event)
                    results.append(result)
                except Exception as e:
                    logger.log('error', f"Synchronous handler failed",
                        extra={
                            'event_type': event_type,
                            'correlation_id': event.correlation_id,
                            'error': str(e)
                        }
                    )
            return results

    finally:
        # End event trace
        end_trace(trace_id)

def subscribe(event_type: str, handler_func: Callable) -> None:
    """Register event handler with validation."""
    
    # Validate handler signature
    if not callable(handler_func):
        raise ValueError("Handler must be callable")

    # Initialize handler list if needed
    if event_type not in EVENT_HANDLERS:
        EVENT_HANDLERS[event_type] = []

    # Check for duplicate handlers
    if handler_func in EVENT_HANDLERS[event_type]:
        logger.log('warning', f"Handler already registered for event type: {event_type}")
        return

    # Register handler
    EVENT_HANDLERS[event_type].append(handler_func)
    
    # Log registration
    logger.log('info', f"Registered handler for event type: {event_type}",
        extra={'handler': handler_func.__name__}
    )

    # Record metric
    track_metric(
        'events.handlers_registered',
        1,
        tags={'event_type': event_type}
    )

def unsubscribe(event_type: str, handler_func: Callable) -> bool:
    """Remove event handler with cleanup."""
    
    if event_type not in EVENT_HANDLERS:
        return False

    try:
        EVENT_HANDLERS[event_type].remove(handler_func)
        
        # Log removal
        logger.log('info', f"Removed handler for event type: {event_type}",
            extra={'handler': handler_func.__name__}
        )

        # Record metric
        track_metric(
            'events.handlers_removed',
            1,
            tags={'event_type': event_type}
        )

        return True
    except ValueError:
        return False

# Initialize global event bus
_event_bus = EventBus()