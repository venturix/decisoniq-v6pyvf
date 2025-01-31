"""
ML training module for Customer Success AI Platform.
Manages model training pipelines, hyperparameter optimization, and model lifecycle
with enhanced performance monitoring and distributed training support.

Dependencies:
- numpy==1.24+
- pandas==2.x
- scikit-learn==1.3+
- sagemaker==2.x
"""

import logging
import time
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.model_selection import train_test_split
import sagemaker
from sagemaker.tuner import HyperparameterTuner

from src.config.ml import get_training_config, get_model_config
from src.ml.feature_store import FeatureStore
from src.integrations.aws.sagemaker import SageMakerClient
from src.core.exceptions import MLModelError

# Configure module logger
logger = logging.getLogger(__name__)

# Model type constants
MODEL_TYPES: dict[str, str] = {
    'churn': 'churn_prediction',
    'expansion': 'expansion_prediction',
    'health': 'health_score',
    'risk': 'risk_assessment'
}

# Training metrics mapping
TRAINING_METRICS: dict[str, str] = {
    'accuracy': 'accuracy_score',
    'precision': 'precision_score',
    'recall': 'recall_score',
    'f1': 'f1_score'
}

# Performance thresholds
PERFORMANCE_THRESHOLDS: dict[str, float] = {
    'accuracy': 0.90,
    'latency': 3.0,
    'drift': 0.10,
    'feature_importance': 0.70
}

class ModelPredictor:
    """Enhanced local interface for model predictions with caching and performance optimization."""

    def __init__(self, endpoint_name: str, cache_ttl: float) -> None:
        """Initialize predictor with enhanced caching and monitoring.
        
        Args:
            endpoint_name: SageMaker endpoint name
            cache_ttl: Cache time-to-live in seconds
        """
        self._sagemaker_session = sagemaker.Session()
        self._endpoint_name = endpoint_name
        self._prediction_cache = {}
        self._cache_ttl = cache_ttl
        
        # Validate endpoint exists
        try:
            self._sagemaker_session.sagemaker_client.describe_endpoint(EndpointName=endpoint_name)
        except Exception as e:
            raise MLModelError(
                message=f"Invalid endpoint: {endpoint_name}",
                model_diagnostics={"error": str(e)}
            )

    async def predict(self, features: pd.DataFrame) -> np.ndarray:
        """Generate predictions using deployed model with caching.
        
        Args:
            features: Input features for prediction
            
        Returns:
            Model predictions
        """
        try:
            # Generate cache key
            cache_key = hash(features.values.tobytes())
            
            # Check cache
            if cache_key in self._prediction_cache:
                cache_entry = self._prediction_cache[cache_key]
                if time.time() - cache_entry['timestamp'] < self._cache_ttl:
                    return cache_entry['predictions']
            
            # Make prediction
            start_time = time.time()
            predictor = sagemaker.predictor.Predictor(
                endpoint_name=self._endpoint_name,
                sagemaker_session=self._sagemaker_session
            )
            predictions = predictor.predict(features.values)
            latency = time.time() - start_time
            
            # Validate latency
            if latency > PERFORMANCE_THRESHOLDS['latency']:
                logger.warning(f"Prediction latency ({latency:.2f}s) exceeded threshold")
            
            # Update cache
            self._prediction_cache[cache_key] = {
                'predictions': predictions,
                'timestamp': time.time()
            }
            
            return predictions
            
        except Exception as e:
            raise MLModelError(
                message="Prediction failed",
                model_diagnostics={"error": str(e)}
            )

class ModelTrainer:
    """Enhanced model trainer with distributed training and performance monitoring."""

    def __init__(self, model_type: str, config: dict) -> None:
        """Initialize model trainer with enhanced monitoring.
        
        Args:
            model_type: Type of model to train
            config: Training configuration
        """
        if model_type not in MODEL_TYPES:
            raise MLModelError(
                message=f"Invalid model type: {model_type}",
                model_diagnostics={"valid_types": list(MODEL_TYPES.keys())}
            )
            
        self._feature_store = FeatureStore()
        self._training_config = get_training_config()
        self._model_config = get_model_config(model_type)
        self._sagemaker_session = sagemaker.Session()
        self._performance_metrics = {
            'training_time': [],
            'validation_scores': [],
            'feature_importance': {}
        }

    async def prepare_training_data(
        self,
        feature_set_id: str,
        feature_names: List[str]
    ) -> Tuple[pd.DataFrame, pd.Series]:
        """Prepare feature data with enhanced validation.
        
        Args:
            feature_set_id: Feature set identifier
            feature_names: List of features to include
            
        Returns:
            Training features and labels
        """
        try:
            # Retrieve features
            features = await self._feature_store.retrieve_features(
                feature_set_id=feature_set_id,
                feature_names=feature_names
            )
            
            # Validate features
            if features.empty:
                raise MLModelError(
                    message="No features found",
                    model_diagnostics={"feature_set_id": feature_set_id}
                )
                
            # Check feature importance
            feature_importance = await self._feature_store.compute_features(
                customer_data=features,
                feature_type='importance'
            )
            
            low_importance = [
                f for f, imp in feature_importance.items()
                if imp < PERFORMANCE_THRESHOLDS['feature_importance']
            ]
            
            if low_importance:
                logger.warning(f"Low importance features detected: {low_importance}")
            
            # Split features and labels
            X = features.drop('target', axis=1)
            y = features['target']
            
            return X, y
            
        except Exception as e:
            raise MLModelError(
                message="Failed to prepare training data",
                model_diagnostics={"error": str(e)}
            )

    async def train_model(
        self,
        training_data: pd.DataFrame,
        labels: pd.Series
    ) -> str:
        """Execute distributed model training with monitoring.
        
        Args:
            training_data: Training features
            labels: Training labels
            
        Returns:
            Trained model artifact path
        """
        try:
            start_time = time.time()
            
            # Configure distributed training
            distribution = {
                'mpi': {
                    'enabled': True,
                    'processes_per_host': self._training_config['compute']['instance_count']
                }
            }
            
            # Initialize estimator
            estimator = sagemaker.estimator.Estimator(
                image_uri=self._model_config['image_uri'],
                role=self._model_config['role'],
                instance_count=self._training_config['compute']['instance_count'],
                instance_type=self._training_config['compute']['instance_type'],
                volume_size=self._training_config['compute']['volume_size_gb'],
                max_run=self._training_config['schedule']['timeout_seconds'],
                input_mode='FastFile',
                output_path=f"s3://{self._sagemaker_session.default_bucket()}/models",
                sagemaker_session=self._sagemaker_session,
                distribution=distribution,
                enable_sagemaker_metrics=True
            )
            
            # Configure hyperparameters
            estimator.set_hyperparameters(**self._model_config['hyperparameters'])
            
            # Prepare training inputs
            train_input = sagemaker.inputs.TrainingInput(
                s3_data=self._upload_training_data(training_data, labels),
                content_type='text/csv'
            )
            
            # Start training job
            job_name = f"{MODEL_TYPES[self._model_config['type']]}-{int(time.time())}"
            estimator.fit({'training': train_input}, job_name=job_name)
            
            # Update metrics
            training_time = time.time() - start_time
            self._performance_metrics['training_time'].append(training_time)
            
            logger.info(f"Model training completed in {training_time:.2f}s")
            return estimator.model_data
            
        except Exception as e:
            raise MLModelError(
                message="Model training failed",
                model_diagnostics={"error": str(e)}
            )

class TrainingPipeline:
    """Enhanced training pipeline with automated model selection and drift detection."""

    def __init__(self, model_type: str) -> None:
        """Initialize enhanced training pipeline.
        
        Args:
            model_type: Type of model to train
        """
        self._trainer = ModelTrainer(model_type, get_model_config(model_type))
        self._pipeline_config = get_training_config()
        self._monitoring_config = {
            'drift_detection': True,
            'performance_tracking': True,
            'model_selection': True
        }

    async def execute_pipeline(self, feature_set_id: str) -> Dict:
        """Execute enhanced training pipeline with monitoring.
        
        Args:
            feature_set_id: Feature set identifier
            
        Returns:
            Pipeline execution results
        """
        try:
            # Prepare training data
            features, labels = await self._trainer.prepare_training_data(
                feature_set_id=feature_set_id,
                feature_names=self._pipeline_config['features']
            )
            
            # Split data
            X_train, X_val, y_train, y_val = train_test_split(
                features,
                labels,
                test_size=self._pipeline_config['data']['validation_split'],
                random_state=42
            )
            
            # Train model
            model_artifact = await self._trainer.train_model(X_train, y_train)
            
            # Evaluate performance
            predictor = ModelPredictor(
                endpoint_name=f"{feature_set_id}-endpoint",
                cache_ttl=300
            )
            predictions = await predictor.predict(X_val)
            
            metrics = {
                'accuracy': accuracy_score(y_val, predictions),
                'precision': precision_score(y_val, predictions),
                'recall': recall_score(y_val, predictions),
                'f1': f1_score(y_val, predictions)
            }
            
            # Validate performance
            if metrics['accuracy'] < PERFORMANCE_THRESHOLDS['accuracy']:
                raise MLModelError(
                    message="Model accuracy below threshold",
                    model_diagnostics={"metrics": metrics}
                )
            
            # Deploy if metrics meet thresholds
            sagemaker_client = SageMakerClient()
            endpoint_name = await sagemaker_client.deploy_model(
                model_name=f"{feature_set_id}-model",
                model_artifact_path=model_artifact,
                model_config=self._pipeline_config
            )
            
            return {
                'status': 'success',
                'metrics': metrics,
                'endpoint': endpoint_name,
                'artifact_path': model_artifact
            }
            
        except Exception as e:
            raise MLModelError(
                message="Pipeline execution failed",
                model_diagnostics={"error": str(e)}
            )