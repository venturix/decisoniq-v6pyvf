"""
Celery worker tasks for machine learning operations in Customer Success AI Platform.
Handles feature processing, model predictions, and model retraining with optimized
performance, caching, and reliability features.

Dependencies:
- celery==5.3.4
- pandas==2.x
- structlog==23.1.0
"""

import structlog
import pandas as pd
from celery import Task
from typing import Dict, Any, Optional

from src.workers.celery import celery_app
from src.ml.pipeline import MLPipeline
from src.ml.predictors import PredictorFactory
from src.core.exceptions import MLModelError

# Configure structured logging
logger = structlog.get_logger(__name__)

# Task retry policy with exponential backoff
ML_TASK_RETRY_POLICY = {
    'max_retries': 3,
    'interval_start': 0,
    'interval_step': 0.2,
    'interval_max': 0.5
}

class MLTask(Task):
    """Base task class for ML operations with enhanced error handling."""

    _pipeline: Optional[MLPipeline] = None

    @property
    def pipeline(self) -> MLPipeline:
        """Lazy initialization of ML pipeline."""
        if self._pipeline is None:
            self._pipeline = MLPipeline()
        return self._pipeline

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Enhanced error handling for ML task failures."""
        logger.error(
            "ml_task_failed",
            task_id=task_id,
            error=str(exc),
            args=args,
            kwargs=kwargs,
            exc_info=einfo
        )
        # Cleanup any partial results
        self.cleanup_on_failure(task_id)

    def cleanup_on_failure(self, task_id: str) -> None:
        """Cleanup resources on task failure."""
        try:
            # Implement cleanup logic
            pass
        except Exception as e:
            logger.error(
                "cleanup_failed",
                task_id=task_id,
                error=str(e)
            )

@celery_app.task(
    queue='ml_predictions',
    base=MLTask,
    bind=True,
    **ML_TASK_RETRY_POLICY
)
def process_customer_features(
    self,
    customer_data: Dict[str, Any],
    model_type: str
) -> str:
    """
    Process and store customer features for ML models with optimized batch processing.

    Args:
        customer_data: Customer data for feature processing
        model_type: Type of model for feature generation

    Returns:
        Feature set identifier
    """
    try:
        logger.info(
            "processing_features",
            model_type=model_type,
            data_size=len(customer_data)
        )

        # Convert dict to DataFrame
        df = pd.DataFrame.from_dict(customer_data)

        # Process features through pipeline
        feature_set_id = self.pipeline.process_features(
            customer_data=df,
            model_type=model_type
        )

        logger.info(
            "features_processed",
            feature_set_id=feature_set_id,
            model_type=model_type
        )

        return feature_set_id

    except Exception as e:
        logger.error(
            "feature_processing_failed",
            error=str(e),
            model_type=model_type
        )
        raise MLModelError(
            message="Feature processing failed",
            model_diagnostics={"error": str(e)}
        )

@celery_app.task(
    queue='ml_predictions',
    base=MLTask,
    bind=True,
    **ML_TASK_RETRY_POLICY
)
def generate_customer_predictions(
    self,
    feature_set_id: str,
    model_type: str
) -> Dict[str, Any]:
    """
    Generate predictions for a customer using specified model with caching.

    Args:
        feature_set_id: Feature set identifier
        model_type: Type of model for predictions

    Returns:
        Prediction results with confidence scores
    """
    try:
        logger.info(
            "generating_predictions",
            feature_set_id=feature_set_id,
            model_type=model_type
        )

        # Get predictor instance
        predictor = PredictorFactory.get_predictor(model_type)

        # Generate predictions through pipeline
        predictions = self.pipeline.generate_predictions(
            feature_set_id=feature_set_id,
            model_type=model_type
        )

        # Validate predictions
        validation_metrics = self.pipeline.validate_predictions(
            predictions=predictions,
            model_type=model_type
        )

        result = {
            'predictions': predictions.to_dict('records'),
            'metrics': validation_metrics,
            'feature_set_id': feature_set_id
        }

        logger.info(
            "predictions_generated",
            feature_set_id=feature_set_id,
            model_type=model_type,
            metrics=validation_metrics
        )

        return result

    except Exception as e:
        logger.error(
            "prediction_generation_failed",
            error=str(e),
            feature_set_id=feature_set_id,
            model_type=model_type
        )
        raise MLModelError(
            message="Prediction generation failed",
            model_diagnostics={"error": str(e)}
        )

@celery_app.task(
    queue='ml_predictions',
    base=MLTask,
    bind=True,
    **ML_TASK_RETRY_POLICY
)
def schedule_model_retraining(
    self,
    model_type: str,
    training_data_id: str
) -> bool:
    """
    Schedule and execute periodic model retraining with drift detection.

    Args:
        model_type: Type of model to retrain
        training_data_id: Training data identifier

    Returns:
        Training success status
    """
    try:
        logger.info(
            "scheduling_retraining",
            model_type=model_type,
            training_data_id=training_data_id
        )

        # Execute retraining through pipeline
        success = self.pipeline.retrain_model(
            model_type=model_type,
            training_data_id=training_data_id
        )

        if success:
            logger.info(
                "model_retrained",
                model_type=model_type,
                training_data_id=training_data_id
            )
        else:
            logger.warning(
                "retraining_failed",
                model_type=model_type,
                training_data_id=training_data_id
            )

        return success

    except Exception as e:
        logger.error(
            "retraining_failed",
            error=str(e),
            model_type=model_type,
            training_data_id=training_data_id
        )
        raise MLModelError(
            message="Model retraining failed",
            model_diagnostics={"error": str(e)}
        )