"""
FastAPI router module for machine learning endpoints in the Customer Success AI Platform.
Handles predictions, model management, and health scoring with optimized performance,
caching, and comprehensive error handling.

Dependencies:
- fastapi==0.100.0
- pandas==2.x
- numpy==1.24+
- redis==4.x
- prometheus_client==0.17+
"""

import logging
import time
from typing import Dict, List, Optional
import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from prometheus_client import Counter, Histogram

from ml.predictors import PredictorFactory
from core.cache import CacheManager
from api.dependencies import get_current_user, get_db_session
from schemas.risk import RiskProfileResponse
from core.exceptions import MLModelError

# Configure module logger
logger = logging.getLogger(__name__)

# Initialize router with prefix and tags
router = APIRouter(prefix='/api/v1/ml', tags=['ML'])

# Initialize core components
predictor_factory = PredictorFactory()
cache_manager = CacheManager()

# Prometheus metrics
PREDICTION_LATENCY = Histogram(
    'prediction_latency_seconds',
    'Time spent processing predictions',
    buckets=[0.1, 0.5, 1.0, 2.0, 3.0, float('inf')]
)
PREDICTION_ERRORS = Counter(
    'prediction_errors_total',
    'Total number of prediction errors'
)

@router.post('/{prediction_type}/predict')
async def get_prediction(
    prediction_type: str,
    input_data: Dict,
    db = Depends(get_db_session),
    current_user = Depends(get_current_user)
) -> Dict:
    """
    Generate optimized predictions using specified ML model with caching and monitoring.
    
    Args:
        prediction_type: Type of prediction to generate
        input_data: Input data for prediction
        db: Database session
        current_user: Authenticated user
        
    Returns:
        Dict containing prediction results with confidence scores
    """
    start_time = time.time()
    
    try:
        # Validate prediction type
        if prediction_type not in ['churn', 'expansion', 'health', 'risk']:
            raise MLModelError(
                message=f"Invalid prediction type: {prediction_type}",
                model_diagnostics={"valid_types": ['churn', 'expansion', 'health', 'risk']}
            )

        # Check cache
        cache_key = f"pred:{prediction_type}:{hash(str(input_data))}"
        cached_result = await cache_manager.get(cache_key)
        if cached_result:
            return cached_result

        # Prepare input data
        df = pd.DataFrame(input_data)
        
        # Get appropriate predictor
        predictor = predictor_factory.get_predictor(prediction_type)
        
        # Generate prediction
        prediction = await predictor.predict(df)
        
        # Format response
        result = {
            'prediction': prediction['prediction'].tolist(),
            'confidence': float(prediction['confidence']),
            'factors': prediction.get('factors', []),
            'timestamp': pd.Timestamp.now().isoformat()
        }
        
        # Cache result
        await cache_manager.set(
            cache_key,
            result,
            'prediction',
            {'ttl': 300}  # 5 minute cache
        )
        
        # Record metrics
        latency = time.time() - start_time
        PREDICTION_LATENCY.observe(latency)
        
        if latency > 3.0:  # SLA threshold
            logger.warning(f"Prediction latency {latency:.2f}s exceeded SLA")
            
        return result

    except Exception as e:
        PREDICTION_ERRORS.inc()
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.post('/{prediction_type}/batch-predict')
async def get_batch_prediction(
    prediction_type: str,
    batch_data: List[Dict],
    db = Depends(get_db_session),
    current_user = Depends(get_current_user)
) -> List[Dict]:
    """
    Handle batch prediction requests with parallel processing and caching.
    
    Args:
        prediction_type: Type of prediction to generate
        batch_data: List of input data for predictions
        db: Database session
        current_user: Authenticated user
        
    Returns:
        List of prediction results
    """
    start_time = time.time()
    
    try:
        # Validate batch size
        if len(batch_data) > 1000:  # Maximum batch size
            raise MLModelError(
                message="Batch size exceeds limit",
                model_diagnostics={"max_size": 1000}
            )

        # Get batch predictor
        predictor = predictor_factory.get_batch_predictor(prediction_type)
        
        # Prepare batch data
        df = pd.DataFrame(batch_data)
        
        # Generate predictions
        predictions = await predictor.predict(df)
        
        # Format results
        results = []
        for i, pred in enumerate(predictions):
            results.append({
                'prediction': pred['prediction'],
                'confidence': float(pred['confidence']),
                'factors': pred.get('factors', []),
                'input_index': i
            })
            
        # Record metrics
        latency = time.time() - start_time
        PREDICTION_LATENCY.observe(latency)
        
        return results

    except Exception as e:
        PREDICTION_ERRORS.inc()
        logger.error(f"Batch prediction failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get('/health-score/{customer_id}')
async def get_health_score(
    customer_id: str,
    db = Depends(get_db_session),
    current_user = Depends(get_current_user)
) -> RiskProfileResponse:
    """
    Calculate customer health score with caching and performance optimization.
    
    Args:
        customer_id: Customer identifier
        db: Database session
        current_user: Authenticated user
        
    Returns:
        Health score with contributing factors
    """
    start_time = time.time()
    
    try:
        # Check cache
        cache_key = f"health:{customer_id}"
        cached_result = await cache_manager.get(cache_key)
        if cached_result:
            return RiskProfileResponse(**cached_result)

        # Get health predictor
        predictor = predictor_factory.get_predictor('health')
        
        # Calculate health score
        health_data = await predictor.predict(pd.DataFrame({'customer_id': [customer_id]}))
        
        # Format response
        result = {
            'customer_id': customer_id,
            'score': float(health_data['health_score']),
            'factors': health_data['component_scores'],
            'assessed_at': pd.Timestamp.now().isoformat()
        }
        
        # Cache result
        await cache_manager.set(
            cache_key,
            result,
            'health_score',
            {'ttl': 300}
        )
        
        # Record metrics
        latency = time.time() - start_time
        PREDICTION_LATENCY.observe(latency)
        
        return RiskProfileResponse(**result)

    except Exception as e:
        PREDICTION_ERRORS.inc()
        logger.error(f"Health score calculation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get('/metrics/{model_type}')
async def get_model_metrics(
    model_type: str,
    db = Depends(get_db_session),
    current_user = Depends(get_current_user)
) -> Dict:
    """
    Retrieve comprehensive performance metrics for ML models.
    
    Args:
        model_type: Type of model to get metrics for
        db: Database session
        current_user: Authenticated user
        
    Returns:
        Dict containing detailed model performance metrics
    """
    try:
        # Get predictor instance
        predictor = predictor_factory.get_predictor(model_type)
        
        # Get base metrics
        metrics = predictor._performance_metrics
        
        # Calculate additional metrics
        avg_latency = np.mean(metrics['prediction_latency']) if metrics['prediction_latency'] else 0
        error_rate = metrics['errors'] / max(1, metrics['predictions'])
        cache_hit_ratio = metrics['cache_hits'] / max(1, metrics['cache_hits'] + metrics['cache_misses'])
        
        return {
            'model_type': model_type,
            'average_latency_ms': float(avg_latency * 1000),
            'error_rate': float(error_rate),
            'cache_hit_ratio': float(cache_hit_ratio),
            'total_predictions': metrics['predictions'],
            'total_errors': metrics['errors'],
            'sla_compliance': avg_latency <= 3.0,  # 3s SLA threshold
            'feature_importance': predictor.get_feature_importance()
        }

    except Exception as e:
        logger.error(f"Failed to get model metrics: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )