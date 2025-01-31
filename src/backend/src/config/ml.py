"""
Machine Learning Configuration Module

Manages settings for ML models, feature store, training pipelines, and prediction services 
in the Customer Success AI Platform.

Dependencies:
- pydantic==2.5.2
"""

import os
from dataclasses import dataclass
from typing import Dict, Any
from pydantic.dataclasses import dataclass
from .aws import sagemaker_config, get_boto3_session

# Global ML configuration settings
ML_MODEL_VERSION = os.getenv('ML_MODEL_VERSION', 'v1')
FEATURE_STORE_ENABLED = os.getenv('FEATURE_STORE_ENABLED', 'True').lower() == 'true'
MODEL_RETRAINING_INTERVAL = int(os.getenv('MODEL_RETRAINING_INTERVAL', '168'))  # Default 7 days in hours

@dataclass
class MLSettings:
    """Machine Learning configuration settings class using Pydantic for validation."""
    
    model_version: str
    feature_store_enabled: bool
    retraining_interval_hours: int
    model_configs: Dict[str, Any]
    feature_store_config: Dict[str, Any]
    training_config: Dict[str, Any]
    prediction_config: Dict[str, Any]

    def __init__(self):
        """Initializes ML settings with environment-specific configurations."""
        self.model_version = ML_MODEL_VERSION
        self.feature_store_enabled = FEATURE_STORE_ENABLED
        self.retraining_interval_hours = MODEL_RETRAINING_INTERVAL
        
        # Initialize configurations
        self.model_configs = {
            'churn_prediction': {
                'model_type': 'xgboost',
                'version': self.model_version,
                'hyperparameters': {
                    'max_depth': 6,
                    'eta': 0.3,
                    'objective': 'binary:logistic',
                    'num_round': 100
                },
                'metrics': {
                    'accuracy_threshold': 0.90,
                    'false_positive_threshold': 0.05,
                    'model_drift_threshold': 0.10
                },
                'artifacts': {
                    'model_path': f's3://cs-ai-platform/models/churn/{self.model_version}',
                    'metadata_path': f's3://cs-ai-platform/metadata/churn/{self.model_version}'
                }
            },
            'expansion_prediction': {
                'model_type': 'lightgbm',
                'version': self.model_version,
                'hyperparameters': {
                    'num_leaves': 31,
                    'learning_rate': 0.05,
                    'objective': 'regression',
                    'metric': 'rmse'
                },
                'metrics': {
                    'rmse_threshold': 0.15,
                    'mae_threshold': 0.12,
                    'model_drift_threshold': 0.10
                },
                'artifacts': {
                    'model_path': f's3://cs-ai-platform/models/expansion/{self.model_version}',
                    'metadata_path': f's3://cs-ai-platform/metadata/expansion/{self.model_version}'
                }
            }
        }

        self.feature_store_config = {
            'storage': {
                'offline_store': {
                    'type': 's3',
                    'path': 's3://cs-ai-platform/feature-store',
                    'format': 'parquet'
                },
                'online_store': {
                    'type': 'dynamodb',
                    'table_name': 'cs-ai-platform-feature-store',
                    'ttl_days': 7
                }
            },
            'features': {
                'update_frequency': 3600,  # 1 hour in seconds
                'batch_size': 1000,
                'validation_threshold': 0.95
            },
            'monitoring': {
                'drift_detection': True,
                'statistics_tracking': True,
                'alert_threshold': 0.1
            }
        }

        self.training_config = {
            'compute': {
                'instance_type': sagemaker_config['instance_type'],
                'instance_count': sagemaker_config['instance_count']['min'],
                'volume_size_gb': 30
            },
            'schedule': {
                'frequency_hours': self.retraining_interval_hours,
                'max_runtime_hours': 4,
                'timeout_seconds': 14400
            },
            'data': {
                'train_test_split': 0.8,
                'validation_split': 0.1,
                'shuffle_buffer_size': 10000
            },
            'monitoring': {
                'enable_cloudwatch': True,
                'log_level': 'INFO',
                'metrics_collection_interval': 60
            }
        }

        self.prediction_config = {
            'endpoint': {
                'instance_type': sagemaker_config['endpoint_config']['instance_type'],
                'initial_instance_count': sagemaker_config['endpoint_config']['initial_instance_count'],
                'variant_name': sagemaker_config['endpoint_config']['variant_name']
            },
            'performance': {
                'max_latency_ms': 3000,  # 3 second SLA
                'target_invocations': 1000,
                'max_concurrent_invocations': sagemaker_config['inference']['max_concurrent_invocations']
            },
            'caching': {
                'ttl_seconds': 300,
                'max_items': 10000,
                'strategy': 'LRU'
            },
            'monitoring': {
                'enable_monitoring': True,
                'sampling_rate': 0.1,
                'alert_threshold_ms': 2500
            }
        }

    def get_model_config(self, model_type: str) -> Dict[str, Any]:
        """Returns configuration for a specific ML model type."""
        if model_type not in self.model_configs:
            raise ValueError(f"Unsupported model type: {model_type}")
        
        base_config = self.model_configs[model_type].copy()
        base_config.update({
            'sagemaker_config': {
                'instance_type': sagemaker_config['instance_type'],
                'instance_count': sagemaker_config['instance_count'],
                'model_retention_days': sagemaker_config['model_retention_days']
            }
        })
        return base_config

    def get_feature_store_config(self) -> Dict[str, Any]:
        """Returns feature store configuration settings."""
        if not self.feature_store_enabled:
            raise RuntimeError("Feature store is not enabled")
        return self.feature_store_config

    def get_training_config(self) -> Dict[str, Any]:
        """Returns training pipeline configuration."""
        return {
            **self.training_config,
            'sagemaker_config': {
                'monitoring': sagemaker_config['monitoring'],
                'instance_type': sagemaker_config['instance_type']
            }
        }

    def get_prediction_config(self) -> Dict[str, Any]:
        """Returns prediction service configuration."""
        return {
            **self.prediction_config,
            'sagemaker_config': {
                'inference': sagemaker_config['inference'],
                'endpoint': sagemaker_config['endpoint_config']
            }
        }

# Create singleton instance of ML settings
ml_settings = MLSettings()

# Export commonly used configurations
model_version = ml_settings.model_version
feature_store_enabled = ml_settings.feature_store_enabled
get_model_config = ml_settings.get_model_config
get_feature_store_config = ml_settings.get_feature_store_config
get_training_config = ml_settings.get_training_config
get_prediction_config = ml_settings.get_prediction_config