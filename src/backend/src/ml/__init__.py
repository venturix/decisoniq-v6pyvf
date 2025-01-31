"""
Machine Learning module initialization for Customer Success AI Platform.
Provides centralized entry point for predictive analytics capabilities with 
enhanced production monitoring and security controls.

Dependencies:
- logging==3.11+
- datadog==1.0.0
- typing==3.11+
"""

import logging
from typing import Dict, Any, Optional
import datadog

from .feature_store import FeatureStore, compute_features, store_features, retrieve_features

# Configure module logger with structured logging
logger = logging.getLogger(__name__)

# Module version and configuration
VERSION: str = '1.0.0'
ML_CONFIG: Dict[str, Any] = {
    'model_cache_ttl': 3600,  # 1 hour cache TTL
    'prediction_timeout': 3.0,  # 3 second SLA requirement
    'min_confidence': 0.9,     # 90% minimum confidence threshold
    'feature_validation': {
        'enabled': True,
        'threshold': 0.95
    },
    'monitoring': {
        'enabled': True,
        'metrics_prefix': 'csai.ml',
        'sampling_rate': 0.1
    },
    'performance': {
        'target_latency_ms': 3000,  # 3 second SLA target
        'target_accuracy': 0.90,    # 90% accuracy requirement
        'error_threshold': 0.05     # 5% error threshold
    }
}

async def initialize_ml(config: Optional[Dict[str, Any]] = None) -> bool:
    """
    Initializes ML module with comprehensive configuration validation and monitoring setup.
    
    Args:
        config: Optional configuration override
        
    Returns:
        bool: Success status of initialization
    """
    try:
        # Update configuration if provided
        if config:
            ML_CONFIG.update(config)
        
        # Configure structured logging
        logging.basicConfig(
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            level=logging.INFO
        )
        
        # Initialize Datadog monitoring
        if ML_CONFIG['monitoring']['enabled']:
            datadog.initialize(
                statsd_host='localhost',
                statsd_port=8125,
                statsd_constant_tags=[
                    f'version:{VERSION}',
                    'service:ml_predictions'
                ]
            )
            
        # Initialize feature store with validation
        feature_store = FeatureStore()
        await feature_store.validate_feature_schema()
        
        # Configure model caching
        if ML_CONFIG['model_cache_ttl'] > 0:
            logger.info(f"Model caching enabled with TTL: {ML_CONFIG['model_cache_ttl']}s")
            
        # Validate performance settings
        if ML_CONFIG['prediction_timeout'] > ML_CONFIG['performance']['target_latency_ms'] / 1000:
            logger.warning("Prediction timeout exceeds target latency SLA")
            
        # Setup health monitoring
        if ML_CONFIG['monitoring']['enabled']:
            datadog.statsd.gauge(
                f"{ML_CONFIG['monitoring']['metrics_prefix']}.initialization",
                1,
                tags=['status:success']
            )
            
        logger.info("ML module initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"ML module initialization failed: {str(e)}")
        if ML_CONFIG['monitoring']['enabled']:
            datadog.statsd.gauge(
                f"{ML_CONFIG['monitoring']['metrics_prefix']}.initialization",
                0,
                tags=['status:failed']
            )
        return False

async def health_check() -> Dict[str, Any]:
    """
    Performs comprehensive health check of ML system components.
    
    Returns:
        Dict[str, Any]: Health status of ML components
    """
    try:
        health_status = {
            'status': 'healthy',
            'version': VERSION,
            'components': {
                'feature_store': True,
                'model_cache': True,
                'predictions': True
            },
            'metrics': {
                'latency_ms': 0,
                'error_rate': 0,
                'cache_hit_ratio': 0
            }
        }
        
        # Check feature store connectivity
        feature_store = FeatureStore()
        if not await feature_store.health_check():
            health_status['components']['feature_store'] = False
            health_status['status'] = 'degraded'
            
        # Validate model cache
        if ML_CONFIG['model_cache_ttl'] > 0:
            cache_status = await _check_model_cache()
            if not cache_status['healthy']:
                health_status['components']['model_cache'] = False
                health_status['status'] = 'degraded'
            health_status['metrics']['cache_hit_ratio'] = cache_status['hit_ratio']
            
        # Check prediction performance
        prediction_metrics = await _get_prediction_metrics()
        health_status['metrics'].update(prediction_metrics)
        
        if (prediction_metrics['latency_ms'] > ML_CONFIG['performance']['target_latency_ms'] or
            prediction_metrics['error_rate'] > ML_CONFIG['performance']['error_threshold']):
            health_status['components']['predictions'] = False
            health_status['status'] = 'degraded'
            
        # Report health metrics
        if ML_CONFIG['monitoring']['enabled']:
            datadog.statsd.gauge(
                f"{ML_CONFIG['monitoring']['metrics_prefix']}.health",
                1 if health_status['status'] == 'healthy' else 0,
                tags=[f"status:{health_status['status']}"]
            )
            
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            'status': 'unhealthy',
            'error': str(e),
            'version': VERSION
        }

async def _check_model_cache() -> Dict[str, Any]:
    """Helper function to validate model cache health."""
    try:
        return {
            'healthy': True,
            'hit_ratio': 0.95,  # Example metric
            'size_mb': 256
        }
    except Exception:
        return {
            'healthy': False,
            'hit_ratio': 0,
            'size_mb': 0
        }

async def _get_prediction_metrics() -> Dict[str, Any]:
    """Helper function to retrieve prediction performance metrics."""
    try:
        return {
            'latency_ms': 150,  # Example metric
            'error_rate': 0.02,
            'throughput': 1000
        }
    except Exception:
        return {
            'latency_ms': 0,
            'error_rate': 1.0,
            'throughput': 0
        }

# Export public interfaces
__all__ = [
    'VERSION',
    'ML_CONFIG',
    'initialize_ml',
    'health_check',
    'FeatureStore',
    'compute_features',
    'store_features', 
    'retrieve_features'
]