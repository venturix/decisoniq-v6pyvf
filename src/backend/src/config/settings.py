"""
Core configuration module for Customer Success AI Platform backend.
Manages global application settings, environment variables, and configuration objects
with enhanced ML performance settings and security validations.

Dependencies:
- pydantic==2.x
- python-dotenv==1.0.0
"""

import os
from typing import Dict, Any
from pydantic import dataclasses
from dotenv import load_dotenv

from .database import DatabaseSettings
from .security import SecuritySettings
from .aws import AWSSettings

# Load environment variables
load_dotenv(override=True)

# Global settings
ENV: str = os.getenv('APP_ENV', 'development')
DEBUG: bool = os.getenv('DEBUG', 'False').lower() == 'true'
API_VERSION: str = 'v1'
PROJECT_NAME: str = 'Customer Success AI Platform'

@dataclasses.dataclass
class Settings:
    """Main application settings class with enhanced ML performance and security features."""
    
    # Core settings
    env: str = ENV
    debug: bool = DEBUG
    api_version: str = API_VERSION
    project_name: str = PROJECT_NAME
    
    # Component settings
    db: DatabaseSettings = dataclasses.field(default_factory=DatabaseSettings)
    security: SecuritySettings = dataclasses.field(default_factory=SecuritySettings)
    aws: AWSSettings = dataclasses.field(default_factory=AWSSettings)

    # ML Model Configuration
    ml_model_configs: Dict[str, Any] = dataclasses.field(default_factory=lambda: {
        'model_version': '1.0.0',
        'model_format': 'pytorch',
        'batch_size': 32,
        'max_sequence_length': 512,
        'num_workers': 4,
        'device': 'cuda',
        'fp16_enabled': True,
        'model_pruning': {
            'enabled': True,
            'target_sparsity': 0.3
        }
    })

    # ML Prediction Configuration
    ml_prediction_config: Dict[str, Any] = dataclasses.field(default_factory=lambda: {
        'timeout_ms': 3000,  # Ensure sub-3s predictions
        'batch_enabled': True,
        'cache_ttl_seconds': 300,
        'fallback_strategy': 'last_known_good',
        'monitoring_enabled': True,
        'performance_logging': True,
        'error_threshold': 0.1
    })

    # ML Feature Store Configuration
    ml_feature_store_config: Dict[str, Any] = dataclasses.field(default_factory=lambda: {
        'storage_format': 'parquet',
        'compression': 'snappy',
        'cache_enabled': True,
        'cache_size_mb': 1024,
        'update_frequency_minutes': 15,
        'validation_enabled': True
    })

    # ML Training Configuration
    ml_training_config: Dict[str, Any] = dataclasses.field(default_factory=lambda: {
        'training_frequency': 'weekly',
        'validation_split': 0.2,
        'early_stopping_patience': 3,
        'max_epochs': 100,
        'learning_rate': 1e-4,
        'optimizer': 'adam',
        'loss_function': 'binary_crossentropy'
    })

    # Performance Thresholds
    performance_thresholds: Dict[str, Any] = dataclasses.field(default_factory=lambda: {
        'api_response_ms': 200,
        'db_query_ms': 100,
        'cache_hit_ratio': 0.85,
        'cpu_threshold': 80,
        'memory_threshold': 85,
        'disk_threshold': 90,
        'error_rate_threshold': 0.01
    })

    # Audit Configuration
    audit_config: Dict[str, Any] = dataclasses.field(default_factory=lambda: {
        'enabled': True,
        'log_level': 'INFO',
        'retention_days': 365,
        'include_request_id': True,
        'include_user_context': True,
        'sensitive_fields': ['password', 'token', 'key'],
        'audit_events': ['login', 'prediction', 'configuration_change']
    })

    # Monitoring Settings
    monitoring_settings: Dict[str, Any] = dataclasses.field(default_factory=lambda: {
        'metrics_enabled': True,
        'metrics_interval_seconds': 60,
        'tracing_enabled': True,
        'log_sampling_rate': 0.1,
        'health_check_interval': 30,
        'alert_channels': ['email', 'slack'],
        'dashboard_refresh_rate': 300
    })

    def get_api_prefix(self) -> str:
        """Returns validated API URL prefix."""
        if not self.api_version.startswith('v'):
            raise ValueError("API version must start with 'v'")
        return f"/api/{self.api_version}"

    def get_app_settings(self) -> Dict[str, Any]:
        """Returns comprehensive application settings."""
        return {
            'env': self.env,
            'debug': self.debug,
            'project_name': self.project_name,
            'api_version': self.api_version,
            'api_prefix': self.get_api_prefix(),
            'performance_thresholds': self.performance_thresholds,
            'monitoring': self.monitoring_settings
        }

    def get_ml_settings(self) -> Dict[str, Any]:
        """Returns optimized ML configuration settings."""
        return {
            'model_config': self.ml_model_configs,
            'prediction_config': self.ml_prediction_config,
            'feature_store': self.ml_feature_store_config,
            'training': self.ml_training_config,
            'performance': {
                'target_prediction_ms': 3000,
                'target_accuracy': 0.9,
                'target_error_rate': 0.1
            }
        }

# Create singleton instance
settings = Settings()