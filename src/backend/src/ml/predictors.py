"""
Core predictors module for Customer Success AI Platform.
Provides base predictor class and orchestrates ML models for customer success predictions
with enhanced performance optimization and caching for sub-3s SLA compliance.

Dependencies:
- numpy==1.24+
- pandas==2.x
- scikit-learn==1.3+
- sagemaker==2.x
- redis==4.x
"""

import abc
import logging
import time
from typing import Dict, Any, Optional, Type
import numpy as np
import pandas as pd
import redis
from functools import wraps

from src.ml.models.churn import ChurnModel
from src.ml.models.expansion import ExpansionModel
from src.ml.models.risk import RiskModel
from src.core.exceptions import MLModelError

# Configure module logger
logger = logging.getLogger(__name__)

# Prediction type mapping
PREDICTION_TYPES: dict[str, str] = {
    'churn': 'churn_risk',
    'expansion': 'expansion_opportunity',
    'health': 'health_score',
    'risk': 'risk_level'
}

# Model registry mapping
MODEL_REGISTRY: dict[str, Type] = {
    'churn': ChurnModel,
    'expansion': ExpansionModel,
    'risk': RiskModel
}

# Health score component weights
HEALTH_SCORE_WEIGHTS: dict[str, float] = {
    'usage': 0.3,
    'engagement': 0.2,
    'support': 0.2,
    'satisfaction': 0.3
}

# Cache and performance settings
CACHE_TTL: int = 300  # 5 minutes
PERFORMANCE_THRESHOLD: float = 3.0  # 3 second SLA

def performance_monitor(func):
    """Decorator for monitoring prediction performance and SLA compliance."""
    @wraps(func)
    async def wrapper(self, *args, **kwargs):
        start_time = time.time()
        try:
            result = await func(self, *args, **kwargs)
            execution_time = time.time() - start_time
            
            # Track performance metrics
            self._performance_metrics['execution_times'].append(execution_time)
            self._performance_metrics['success_count'] += 1
            
            # Check SLA compliance
            if execution_time > PERFORMANCE_THRESHOLD:
                logger.warning(
                    f"Prediction exceeded SLA threshold: {execution_time:.2f}s"
                )
            
            return result
            
        except Exception as e:
            self._performance_metrics['error_count'] += 1
            logger.error(f"Prediction error: {str(e)}")
            raise
            
    return wrapper

class BasePredictor(abc.ABC):
    """Enhanced abstract base class for all prediction models with performance optimization."""

    def __init__(self, model_type: str, config: Dict[str, Any]) -> None:
        """Initialize base predictor with configuration and caching.
        
        Args:
            model_type: Type of prediction model
            config: Model configuration parameters
        """
        if model_type not in MODEL_REGISTRY:
            raise MLModelError(
                message=f"Invalid model type: {model_type}",
                model_diagnostics={"valid_types": list(MODEL_REGISTRY.keys())}
            )
            
        self._model_type = model_type
        self._config = config
        
        # Initialize model instance
        self._model = MODEL_REGISTRY[model_type](config)
        
        # Initialize Redis cache
        self._cache = redis.Redis(
            host=config.get('cache_host', 'localhost'),
            port=config.get('cache_port', 6379),
            db=config.get('cache_db', 0),
            socket_timeout=5
        )
        
        # Initialize performance tracking
        self._performance_metrics = {
            'execution_times': [],
            'success_count': 0,
            'error_count': 0,
            'cache_hits': 0,
            'cache_misses': 0
        }
        
        logger.info(f"Initialized {model_type} predictor")

    @abc.abstractmethod
    @performance_monitor
    async def predict(self, input_data: pd.DataFrame) -> pd.DataFrame:
        """Abstract method for generating predictions with performance monitoring.
        
        Args:
            input_data: Input data for prediction
            
        Returns:
            Prediction results with confidence scores
        """
        pass

    def validate_input(self, input_data: pd.DataFrame) -> bool:
        """Validates input data format and content.
        
        Args:
            input_data: Input data to validate
            
        Returns:
            Validation result
        """
        try:
            # Check data type
            if not isinstance(input_data, pd.DataFrame):
                logger.error("Invalid input type")
                return False
                
            # Check for empty data
            if input_data.empty:
                logger.error("Empty input data")
                return False
                
            # Check required columns
            required_columns = self._config.get('required_columns', [])
            missing_columns = [col for col in required_columns 
                             if col not in input_data.columns]
            if missing_columns:
                logger.error(f"Missing required columns: {missing_columns}")
                return False
                
            # Validate data types
            for col, dtype in self._config.get('column_types', {}).items():
                if col in input_data.columns and not input_data[col].dtype == dtype:
                    logger.error(f"Invalid data type for column {col}")
                    return False
                    
            return True
            
        except Exception as e:
            logger.error(f"Input validation error: {str(e)}")
            return False

class HealthPredictor(BasePredictor):
    """Enhanced health score predictor with configurable weights and performance optimization."""

    def __init__(self, config: Dict[str, Any]) -> None:
        """Initialize health predictor with optimized configuration.
        
        Args:
            config: Predictor configuration
        """
        super().__init__('health', config)
        
        # Initialize component weights
        self._weights = HEALTH_SCORE_WEIGHTS
        
        # Configure health score thresholds
        self._thresholds = {
            'critical': 0.3,
            'poor': 0.5,
            'fair': 0.7,
            'good': 0.85,
            'excellent': 1.0
        }
        
        # Initialize cache with namespace
        self._cache = redis.Redis(
            host=config.get('cache_host', 'localhost'),
            port=config.get('cache_port', 6379),
            db=config.get('cache_db', 0),
            socket_timeout=5
        )

    @performance_monitor
    async def predict(self, input_data: pd.DataFrame) -> pd.DataFrame:
        """Generate health score predictions with caching and monitoring.
        
        Args:
            input_data: Customer metrics data
            
        Returns:
            Health score predictions with component breakdowns
        """
        try:
            # Validate input
            if not self.validate_input(input_data):
                raise MLModelError(
                    message="Invalid input data",
                    model_diagnostics={"data_shape": input_data.shape}
                )
                
            # Calculate health scores
            results = []
            for _, row in input_data.iterrows():
                # Generate cache key
                cache_key = f"health:{row['customer_id']}"
                
                # Check cache
                cached_score = self._cache.get(cache_key)
                if cached_score:
                    self._performance_metrics['cache_hits'] += 1
                    results.append(pd.read_json(cached_score))
                    continue
                    
                self._performance_metrics['cache_misses'] += 1
                
                # Calculate component scores
                health_score = await self.calculate_health_score(row)
                
                # Determine health level
                health_level = next(
                    (level for level, threshold in self._thresholds.items()
                     if health_score <= threshold),
                    'excellent'
                )
                
                # Prepare result
                result = pd.DataFrame({
                    'customer_id': [row['customer_id']],
                    'health_score': [health_score],
                    'health_level': [health_level],
                    'component_scores': [{
                        'usage': row['usage_score'] * self._weights['usage'],
                        'engagement': row['engagement_score'] * self._weights['engagement'],
                        'support': row['support_score'] * self._weights['support'],
                        'satisfaction': row['satisfaction_score'] * self._weights['satisfaction']
                    }],
                    'timestamp': [pd.Timestamp.now()]
                })
                
                # Update cache
                self._cache.setex(
                    cache_key,
                    CACHE_TTL,
                    result.to_json()
                )
                
                results.append(result)
                
            return pd.concat(results, ignore_index=True)
            
        except Exception as e:
            logger.error(f"Health score prediction failed: {str(e)}")
            raise MLModelError(
                message="Health score prediction failed",
                model_diagnostics={"error": str(e)}
            )

    async def calculate_health_score(self, metrics_data: pd.DataFrame) -> float:
        """Calculate weighted health score with validation.
        
        Args:
            metrics_data: Customer metrics data
            
        Returns:
            Calculated health score
        """
        try:
            # Validate metrics
            required_metrics = ['usage_score', 'engagement_score', 
                              'support_score', 'satisfaction_score']
            if not all(metric in metrics_data for metric in required_metrics):
                raise MLModelError(
                    message="Missing required metrics",
                    model_diagnostics={"available_metrics": list(metrics_data.keys())}
                )
                
            # Calculate weighted score
            weighted_score = sum(
                metrics_data[f"{component}_score"] * weight
                for component, weight in self._weights.items()
            )
            
            # Normalize score
            normalized_score = np.clip(weighted_score, 0, 1)
            
            return float(normalized_score)
            
        except Exception as e:
            logger.error(f"Health score calculation failed: {str(e)}")
            raise MLModelError(
                message="Health score calculation failed",
                model_diagnostics={"error": str(e)}
            )