"""
Machine Learning Test Initialization Module

Provides comprehensive test infrastructure for ML model validation, feature management,
and performance metrics with enhanced security and monitoring.

Dependencies:
- pytest==7.x
- numpy==1.24+
- pandas==2.x
- scikit-learn==1.3+
"""

import os
import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Optional
import pytest
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

from src.ml.feature_store import FeatureStore
from src.config.ml import get_model_config, get_feature_store_config

# Configure test logger
logger = logging.getLogger(__name__)

# Test data paths and thresholds from technical specification
ML_TEST_DATA_PATH = 'tests/data/ml'
MODEL_ACCURACY_THRESHOLD = 0.90  # 90% accuracy requirement
FALSE_POSITIVE_THRESHOLD = 0.05  # 5% false positive rate limit
FEATURE_IMPORTANCE_THRESHOLD = 0.70  # 0.7 feature importance requirement
MODEL_DRIFT_THRESHOLD = 0.10  # 10% model drift threshold

@pytest.fixture
@pytest.mark.ml
def generate_test_features(sample_size: int = 1000, include_drift: bool = False, 
                         noise_factor: float = 0.1) -> pd.DataFrame:
    """
    Creates synthetic feature data for ML model testing with production-like characteristics.
    
    Args:
        sample_size: Number of test samples to generate
        include_drift: Whether to include synthetic drift
        noise_factor: Amount of noise to add for realistic variation
        
    Returns:
        DataFrame containing test features with usage patterns and engagement metrics
    """
    try:
        # Generate base customer behavior patterns
        np.random.seed(42)  # Ensure reproducibility
        
        features = pd.DataFrame({
            'customer_id': [f'CUST_{i:06d}' for i in range(sample_size)],
            'timestamp': pd.date_range(start='2024-01-01', periods=sample_size, freq='H'),
            
            # Usage metrics
            'login_frequency': np.random.gamma(5, 2, sample_size),
            'feature_adoption': np.random.beta(2, 5, sample_size),
            'active_users': np.random.poisson(10, sample_size),
            
            # Engagement metrics
            'nps_score': np.random.normal(7.5, 1.5, sample_size).clip(0, 10),
            'support_tickets': np.random.poisson(3, sample_size),
            'response_time': np.random.exponential(2, sample_size),
            
            # Revenue metrics
            'mrr': np.random.lognormal(8, 0.5, sample_size),
            'upsell_probability': np.random.beta(3, 7, sample_size)
        })
        
        # Add realistic noise
        for col in features.select_dtypes(include=[np.number]).columns:
            noise = np.random.normal(0, noise_factor, sample_size)
            features[col] = features[col] * (1 + noise)
        
        # Include synthetic drift if specified
        if include_drift:
            drift_factor = np.linspace(0, MODEL_DRIFT_THRESHOLD, sample_size)
            features['feature_adoption'] *= (1 + drift_factor)
            features['nps_score'] *= (1 - drift_factor)
        
        # Validate data quality
        assert not features.isnull().any().any(), "Generated features contain null values"
        assert len(features) == sample_size, "Incorrect number of samples generated"
        
        logger.info(
            "Test features generated successfully",
            extra={
                'sample_size': sample_size,
                'include_drift': include_drift,
                'feature_count': len(features.columns)
            }
        )
        
        return features
        
    except Exception as e:
        logger.error(f"Failed to generate test features: {str(e)}")
        raise

@pytest.mark.ml
def calculate_model_metrics(y_true: np.ndarray, y_pred: np.ndarray, 
                          feature_importance: np.ndarray) -> Dict:
    """
    Computes comprehensive test metrics for ML model evaluation with confidence intervals.
    
    Args:
        y_true: True labels
        y_pred: Predicted labels
        feature_importance: Feature importance scores
        
    Returns:
        Dictionary containing accuracy, precision, recall, F1 score, and confidence intervals
    """
    try:
        # Calculate base classification metrics
        metrics = {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision': precision_score(y_true, y_pred, average='weighted'),
            'recall': recall_score(y_true, y_pred, average='weighted'),
            'f1_score': f1_score(y_true, y_pred, average='weighted')
        }
        
        # Compute confidence intervals using bootstrapping
        n_iterations = 1000
        bootstrap_metrics = {
            'accuracy': [],
            'precision': [],
            'recall': [],
            'f1_score': []
        }
        
        for _ in range(n_iterations):
            indices = np.random.randint(0, len(y_true), len(y_true))
            bootstrap_metrics['accuracy'].append(accuracy_score(y_true[indices], y_pred[indices]))
            bootstrap_metrics['precision'].append(precision_score(y_true[indices], y_pred[indices], average='weighted'))
            bootstrap_metrics['recall'].append(recall_score(y_true[indices], y_pred[indices], average='weighted'))
            bootstrap_metrics['f1_score'].append(f1_score(y_true[indices], y_pred[indices], average='weighted'))
        
        # Calculate 95% confidence intervals
        for metric in metrics.keys():
            metrics[f'{metric}_ci'] = np.percentile(bootstrap_metrics[metric], [2.5, 97.5])
        
        # Assess feature importance
        metrics['feature_importance'] = {
            'scores': feature_importance.tolist(),
            'mean': float(np.mean(feature_importance)),
            'std': float(np.std(feature_importance))
        }
        
        # Calculate model drift indicators
        metrics['model_drift'] = {
            'accuracy_threshold_gap': metrics['accuracy'] - MODEL_ACCURACY_THRESHOLD,
            'false_positive_rate': 1 - metrics['precision'],
            'feature_importance_score': float(np.mean(feature_importance))
        }
        
        logger.info(
            "Model metrics calculated successfully",
            extra={
                'accuracy': metrics['accuracy'],
                'precision': metrics['precision'],
                'drift_indicators': metrics['model_drift']
            }
        )
        
        return metrics
        
    except Exception as e:
        logger.error(f"Failed to calculate model metrics: {str(e)}")
        raise

@pytest.mark.ml
class BaseMLTest:
    """
    Base class for ML model unit tests with enhanced isolation and performance monitoring.
    """
    
    def __init__(self, test_name: str):
        """
        Initialize base ML test class with configuration.
        
        Args:
            test_name: Name of the test for logging and monitoring
        """
        self.test_name = test_name
        self.feature_store = FeatureStore()
        self.accuracy_threshold = MODEL_ACCURACY_THRESHOLD
        self.false_positive_threshold = FALSE_POSITIVE_THRESHOLD
        self.feature_importance_threshold = FEATURE_IMPORTANCE_THRESHOLD
        self.temp_data_path = os.path.join(ML_TEST_DATA_PATH, test_name)
        
        # Initialize test metrics collection
        self.test_metrics = {
            'execution_time': [],
            'memory_usage': [],
            'feature_count': 0,
            'error_count': 0
        }
        
        logger.info(
            f"Initialized ML test: {test_name}",
            extra={'thresholds': {
                'accuracy': self.accuracy_threshold,
                'false_positive': self.false_positive_threshold,
                'feature_importance': self.feature_importance_threshold
            }}
        )

    async def setUp(self):
        """
        Comprehensive test setup with isolation.
        """
        try:
            # Create isolated test directory
            os.makedirs(self.temp_data_path, exist_ok=True)
            
            # Initialize clean feature store
            await self.feature_store.clear_features()
            
            # Configure test monitoring
            logger.info(
                f"Setting up test environment: {self.test_name}",
                extra={'temp_path': self.temp_data_path}
            )
            
        except Exception as e:
            logger.error(f"Test setup failed: {str(e)}")
            raise

    async def tearDown(self):
        """
        Thorough test cleanup and resource management.
        """
        try:
            # Clean up test data
            if os.path.exists(self.temp_data_path):
                import shutil
                shutil.rmtree(self.temp_data_path)
            
            # Clear feature store
            await self.feature_store.clear_features()
            
            # Log test execution metrics
            logger.info(
                f"Test cleanup completed: {self.test_name}",
                extra={
                    'metrics': self.test_metrics,
                    'errors': self.test_metrics['error_count']
                }
            )
            
        except Exception as e:
            logger.error(f"Test cleanup failed: {str(e)}")
            raise