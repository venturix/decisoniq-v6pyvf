"""
ML integration tests initialization module for Customer Success AI Platform.
Provides test environment setup, fixtures, and validation utilities for testing
ML model performance, prediction latency, and feature management.

Dependencies:
- pytest==7.x
- numpy==1.24+
"""

import logging
import os
import time
from typing import Dict, Any
import pytest
import numpy as np

from src.ml.feature_store import FeatureStore
from src.ml.predictors import ChurnPredictor, RiskPredictor
from src.core.exceptions import MLModelError

# Configure test logger
logger = logging.getLogger(__name__)

# Test data path and configuration
ML_TEST_DATA_PATH: str = 'tests/data/ml'

# Performance thresholds from technical specification
PREDICTION_TIMEOUT: float = 3.0  # 3 second SLA requirement
ACCURACY_THRESHOLD: float = 0.90  # 90% accuracy requirement
FALSE_POSITIVE_THRESHOLD: float = 0.05  # 5% false positive rate limit
MODEL_DRIFT_THRESHOLD: float = 0.10  # 10% model drift threshold

@pytest.fixture(scope='session')
def setup_ml_test_env() -> None:
    """
    Configures ML testing environment with comprehensive monitoring and validation.
    Sets up test data, feature store, and performance tracking for ML integration tests.
    
    Raises:
        MLModelError: If test environment setup fails
    """
    try:
        logger.info("Initializing ML test environment")
        
        # Validate test data directory
        if not os.path.exists(ML_TEST_DATA_PATH):
            os.makedirs(ML_TEST_DATA_PATH)
            logger.info(f"Created ML test data directory: {ML_TEST_DATA_PATH}")
            
        # Initialize feature store for testing
        feature_store = FeatureStore()
        
        # Configure test data validation thresholds
        validation_config = {
            'accuracy_threshold': ACCURACY_THRESHOLD,
            'false_positive_threshold': FALSE_POSITIVE_THRESHOLD,
            'model_drift_threshold': MODEL_DRIFT_THRESHOLD,
            'prediction_timeout': PREDICTION_TIMEOUT
        }
        
        # Initialize performance monitoring
        performance_metrics = {
            'prediction_latency': [],
            'accuracy_scores': [],
            'error_counts': 0,
            'cache_hits': 0,
            'cache_misses': 0
        }
        
        # Set up test data security controls
        security_config = {
            'encryption_enabled': True,
            'data_masking': True,
            'audit_logging': True
        }
        
        # Configure resource limits
        resource_limits = {
            'max_batch_size': 1000,
            'max_concurrent_predictions': 10,
            'max_cache_size': 10000
        }
        
        # Initialize test result caching
        test_cache = {
            'predictions': {},
            'feature_sets': {},
            'validation_results': {}
        }
        
        # Set up cleanup procedures
        def cleanup():
            try:
                # Clear test cache
                test_cache.clear()
                
                # Reset performance metrics
                performance_metrics.update({
                    'prediction_latency': [],
                    'accuracy_scores': [],
                    'error_counts': 0
                })
                
                logger.info("Test environment cleanup completed")
                
            except Exception as e:
                logger.error(f"Test cleanup failed: {str(e)}")
                raise MLModelError(
                    message="Test environment cleanup failed",
                    model_diagnostics={"error": str(e)}
                )
        
        # Register cleanup handler
        pytest.register_assert_rewrite('tests.integration.ml.test_predictors')
        pytest.register_assert_rewrite('tests.integration.ml.test_feature_store')
        
        logger.info(
            "ML test environment initialized successfully",
            extra={
                'validation_config': validation_config,
                'security_config': security_config,
                'resource_limits': resource_limits
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to initialize ML test environment: {str(e)}")
        raise MLModelError(
            message="ML test environment initialization failed",
            model_diagnostics={"error": str(e)}
        )

# Export test configuration and fixtures
__all__ = [
    'setup_ml_test_env',
    'ML_TEST_DATA_PATH',
    'PREDICTION_TIMEOUT',
    'ACCURACY_THRESHOLD', 
    'FALSE_POSITIVE_THRESHOLD',
    'MODEL_DRIFT_THRESHOLD'
]