"""
Workers package initialization for Customer Success AI Platform.
Configures and exports Celery application instance and task modules with enhanced
queue management, monitoring, and reliability features.

Dependencies:
- celery==5.3.4
- redis==4.6.0
"""

from typing import Dict, Any
from .celery import celery_app
from .tasks.notifications import send_single_notification, send_bulk_notifications

# Package version
VERSION = '1.0.0'

# Enhanced worker queue configuration with comprehensive monitoring
WORKER_QUEUES: Dict[str, Dict[str, Any]] = {
    'ml': {
        'queue_name': 'ml_predictions',
        'priority': 'high',
        'rate_limit': '1000/m',  # 1000 tasks per minute
        'retry_policy': {
            'max_retries': 3,
            'interval_start': 0,
            'interval_step': 2,
            'interval_max': 10
        },
        'dead_letter_queue': 'ml_predictions_dlq',
        'sla_threshold': '3s',  # Sub-3s predictions requirement
        'monitoring': {
            'alert_threshold': '5s',
            'error_threshold': '1%'
        }
    },
    'notifications': {
        'queue_name': 'notifications',
        'priority': 'medium',
        'rate_limit': '5000/m',  # 5000 notifications per minute
        'retry_policy': {
            'max_retries': 5,
            'interval_start': 1,
            'interval_step': 1,
            'interval_max': 30
        },
        'dead_letter_queue': 'notifications_dlq',
        'sla_threshold': '30s',
        'monitoring': {
            'alert_threshold': '1m',
            'error_threshold': '0.1%'
        }
    },
    'integrations': {
        'queue_name': 'integrations',
        'priority': 'low',
        'rate_limit': '500/m',  # 500 integration tasks per minute
        'retry_policy': {
            'max_retries': 10,
            'interval_start': 5,
            'interval_step': 5,
            'interval_max': 300
        },
        'dead_letter_queue': 'integrations_dlq',
        'sla_threshold': '5m',
        'monitoring': {
            'alert_threshold': '10m',
            'error_threshold': '5%'
        }
    },
    'playbooks': {
        'queue_name': 'playbooks',
        'priority': 'high',
        'rate_limit': '200/m',  # 200 playbook executions per minute
        'retry_policy': {
            'max_retries': 3,
            'interval_start': 1,
            'interval_step': 2,
            'interval_max': 60
        },
        'dead_letter_queue': 'playbooks_dlq',
        'sla_threshold': '1m',
        'monitoring': {
            'alert_threshold': '2m',
            'error_threshold': '0.5%'
        }
    }
}

# Export Celery application and task modules
__all__ = [
    'celery_app',
    'send_single_notification',
    'send_bulk_notifications',
    'WORKER_QUEUES'
]