"""
Celery worker configuration and initialization module for the Customer Success AI Platform.
Manages distributed task queues for ML predictions, notifications, and playbook executions
with high availability, performance optimization, and robust error handling.

Dependencies:
- celery==5.3.4
- redis==4.6.0
- structlog==23.1.0
"""

import os
import multiprocessing
from celery import Celery
from celery.signals import worker_ready, worker_shutdown
import structlog
from src.config.settings import env, debug, REDIS_URL

# Configure structured logging
logger = structlog.get_logger(__name__)

# Redis connection settings with SSL and timeouts
REDIS_URL = REDIS_URL
REDIS_SSL_CONFIG = {
    'ssl_cert_reqs': 'CERT_REQUIRED',
    'ssl_ca_certs': os.getenv('REDIS_CA_CERTS'),
    'socket_timeout': 5.0,
    'socket_connect_timeout': 5.0
}

# Task queue definitions with priority support
TASK_QUEUES = {
    'ml_predictions': {
        'exchange': 'ml',
        'routing_key': 'ml.#',
        'queue_arguments': {'x-max-priority': 10}
    },
    'notifications': {
        'exchange': 'notifications',
        'routing_key': 'notification.#',
        'queue_arguments': {'x-max-priority': 5}
    },
    'playbooks': {
        'exchange': 'playbooks',
        'routing_key': 'playbook.#',
        'queue_arguments': {'x-max-priority': 3}
    }
}

# Task routing configuration
TASK_ROUTES = {
    'src.workers.tasks.ml.*': {
        'queue': 'ml_predictions',
        'exchange': 'ml'
    },
    'src.workers.tasks.notifications.*': {
        'queue': 'notifications',
        'exchange': 'notifications'
    },
    'src.workers.tasks.playbooks.*': {
        'queue': 'playbooks',
        'exchange': 'playbooks'
    }
}

class CeleryConfig:
    """Comprehensive configuration class for Celery worker settings."""
    
    # Broker and backend settings
    broker_url = REDIS_URL
    result_backend = REDIS_URL
    broker_transport_options = REDIS_SSL_CONFIG
    result_backend_transport_options = REDIS_SSL_CONFIG
    
    # Queue configuration
    task_queues = TASK_QUEUES
    task_routes = TASK_ROUTES
    task_default_queue = 'default'
    task_create_missing_queues = True
    
    # Worker settings
    worker_prefetch_multiplier = 1
    worker_concurrency = multiprocessing.cpu_count()
    worker_max_tasks_per_child = 1000
    worker_max_memory_per_child = 150000  # 150MB
    
    # Task execution settings
    task_time_limit = 1800  # 30 minutes
    task_soft_time_limit = 1500  # 25 minutes
    task_acks_late = True
    task_reject_on_worker_lost = True
    
    # Task result settings
    result_expires = 86400  # 24 hours
    result_compression = 'gzip'
    result_extended = True
    
    # Performance optimization
    worker_disable_rate_limits = False
    task_compression = 'gzip'
    task_serializer = 'json'
    result_serializer = 'json'
    accept_content = ['json']
    
    # Monitoring and logging
    worker_send_task_events = True
    task_send_sent_event = True
    task_track_started = True
    task_store_errors_even_if_ignored = True
    
    # Error handling
    task_annotations = {
        '*': {
            'rate_limit': '100/s',
            'retry_backoff': True,
            'retry_backoff_max': 600,  # 10 minutes
            'retry_jitter': True,
            'max_retries': 3
        }
    }

def init_celery() -> Celery:
    """Initialize and configure the Celery application with optimized settings."""
    
    # Create Celery application
    app = Celery('cs_ai_platform')
    
    # Load configuration
    app.config_from_object(CeleryConfig)
    
    # Configure logging
    app.log.setup(loglevel='INFO' if not debug else 'DEBUG')
    
    @worker_ready.connect
    def on_worker_ready(sender, **kwargs):
        """Handler for worker startup events."""
        logger.info(
            "worker_ready",
            worker_id=sender.hostname,
            queues=list(TASK_QUEUES.keys()),
            concurrency=CeleryConfig.worker_concurrency
        )
    
    @worker_shutdown.connect
    def on_worker_shutdown(sender, **kwargs):
        """Handler for worker shutdown events."""
        logger.info(
            "worker_shutdown",
            worker_id=sender.hostname,
            processed_tasks=sender.processed
        )
    
    # Register task modules
    app.autodiscover_tasks([
        'src.workers.tasks.ml',
        'src.workers.tasks.notifications',
        'src.workers.tasks.playbooks'
    ])
    
    return app

# Initialize Celery application
celery_app = init_celery()

# Export Celery application instance
__all__ = ['celery_app']