"""
Integration tests for ML prediction services validating model predictions, accuracy,
and performance across different prediction types with comprehensive test coverage.

Dependencies:
- pytest==7.x
- numpy==1.24+
- pandas==2.x
"""

import pytest
import numpy as np
import pandas as pd
import time
from typing import Dict, Any

from src.ml.predictors import BasePredictor, HealthPredictor, PredictorFactory
from src.ml.models.churn import ChurnModel
from src.core.exceptions import MLModelError

# Test configuration constants
TEST_DATA_SIZE = 1000
ACCURACY_THRESHOLD = 0.90
FALSE_POSITIVE_THRESHOLD = 0.05
PREDICTION_TIMEOUT = 3  # 3 second SLA
CACHE_TTL = 3600
DRIFT_THRESHOLD = 0.10

@pytest.fixture
def generate_test_data(size: int = TEST_DATA_SIZE, include_drift: bool = False) -> pd.DataFrame:
    """Generate realistic test dataset with proper feature distributions."""
    
    # Generate base customer data
    data = pd.DataFrame({
        'customer_id': [f'CUST_{i}' for i in range(size)],
        'usage_score': np.random.uniform(0, 1, size),
        'engagement_score': np.random.uniform(0, 1, size),
        'support_score': np.random.uniform(0, 1, size),
        'satisfaction_score': np.random.uniform(0, 1, size),
        'revenue': np.random.lognormal(mean=8, sigma=1, size=size),
        'contract_months': np.random.randint(1, 36, size)
    })
    
    # Add temporal patterns
    data['usage_trend'] = data['usage_score'].rolling(window=3, min_periods=1).mean()
    data['engagement_trend'] = data['engagement_score'].ewm(span=30).mean()
    
    # Add realistic correlations
    data['churn_risk'] = 1 - (
        0.3 * data['usage_score'] +
        0.2 * data['engagement_score'] +
        0.2 * data['support_score'] +
        0.3 * data['satisfaction_score']
    )
    
    # Inject controlled drift if specified
    if include_drift:
        drift_mask = np.random.choice([True, False], size=size, p=[0.2, 0.8])
        data.loc[drift_mask, 'usage_score'] *= 0.7
        data.loc[drift_mask, 'engagement_score'] *= 0.8
    
    return data

@pytest.mark.integration
class TestPredictions:
    """Comprehensive test suite for ML prediction services with performance monitoring."""
    
    def setup_method(self):
        """Setup before each test method with clean state."""
        self._factory = PredictorFactory()
        self._test_config = {
            'cache_enabled': True,
            'cache_ttl': CACHE_TTL,
            'performance_monitoring': True
        }
        self._factory.clear_cache()
        self._metrics = {'latency': [], 'accuracy': [], 'errors': 0}
    
    def teardown_method(self):
        """Cleanup after each test method."""
        self._factory.reset_state()
    
    @pytest.mark.integration
    async def test_churn_prediction_accuracy(self, generate_test_data):
        """Test churn prediction accuracy with comprehensive metrics."""
        test_data = generate_test_data(size=TEST_DATA_SIZE)
        
        # Initialize churn predictor
        predictor = self._factory.get_predictor('churn')
        
        # Generate predictions
        start_time = time.time()
        predictions = await predictor.predict(test_data)
        latency = time.time() - start_time
        
        # Validate prediction structure
        assert isinstance(predictions, pd.DataFrame)
        assert 'churn_probability' in predictions.columns
        assert 'confidence_score' in predictions.columns
        
        # Validate prediction values
        assert predictions['churn_probability'].between(0, 1).all()
        assert predictions['confidence_score'].between(0, 1).all()
        
        # Verify performance SLA
        assert latency < PREDICTION_TIMEOUT, f"Prediction latency {latency}s exceeded SLA {PREDICTION_TIMEOUT}s"
        
        # Track metrics
        self._metrics['latency'].append(latency)
    
    @pytest.mark.integration
    async def test_health_score_prediction(self, generate_test_data):
        """Test health score predictions with component validation."""
        test_data = generate_test_data(size=TEST_DATA_SIZE)
        
        # Initialize health predictor
        predictor = HealthPredictor(self._test_config)
        
        # Generate predictions
        start_time = time.time()
        predictions = await predictor.predict(test_data)
        latency = time.time() - start_time
        
        # Validate prediction structure
        assert isinstance(predictions, pd.DataFrame)
        assert 'health_score' in predictions.columns
        assert 'component_scores' in predictions.columns
        
        # Validate component scores
        for row in predictions['component_scores']:
            assert isinstance(row, dict)
            assert all(k in row for k in ['usage', 'engagement', 'support', 'satisfaction'])
            assert all(0 <= v <= 1 for v in row.values())
        
        # Verify performance
        assert latency < PREDICTION_TIMEOUT
        self._metrics['latency'].append(latency)
    
    @pytest.mark.integration
    async def test_prediction_caching(self, generate_test_data):
        """Test prediction caching behavior and performance."""
        test_data = generate_test_data(size=TEST_DATA_SIZE)
        predictor = self._factory.get_predictor('churn')
        
        # First prediction (cache miss)
        start_time = time.time()
        first_prediction = await predictor.predict(test_data)
        first_latency = time.time() - start_time
        
        # Second prediction (cache hit)
        start_time = time.time()
        second_prediction = await predictor.predict(test_data)
        second_latency = time.time() - start_time
        
        # Verify cache hit is faster
        assert second_latency < first_latency
        assert np.array_equal(first_prediction.values, second_prediction.values)
    
    @pytest.mark.integration
    async def test_model_drift_detection(self, generate_test_data):
        """Test model drift detection with controlled data drift."""
        # Generate baseline data
        baseline_data = generate_test_data(size=TEST_DATA_SIZE, include_drift=False)
        
        # Generate drift data
        drift_data = generate_test_data(size=TEST_DATA_SIZE, include_drift=True)
        
        # Initialize model
        model = ChurnModel(self._test_config)
        
        # Calculate drift score
        drift_score = await model.check_drift(baseline_data, drift_data)
        
        # Verify drift detection
        assert isinstance(drift_score, float)
        assert 0 <= drift_score <= 1
        assert drift_score > DRIFT_THRESHOLD
    
    @pytest.mark.integration
    async def test_prediction_error_handling(self, generate_test_data):
        """Test error handling for invalid prediction inputs."""
        predictor = self._factory.get_predictor('churn')
        
        # Test with empty DataFrame
        with pytest.raises(MLModelError) as exc_info:
            await predictor.predict(pd.DataFrame())
        assert "Invalid input data" in str(exc_info.value)
        
        # Test with missing required features
        invalid_data = pd.DataFrame({'customer_id': range(10)})
        with pytest.raises(MLModelError) as exc_info:
            await predictor.predict(invalid_data)
        assert "Missing required features" in str(exc_info.value)
    
    @pytest.mark.integration
    async def test_batch_prediction_performance(self, generate_test_data):
        """Test batch prediction performance and scaling."""
        batch_sizes = [100, 500, 1000]
        predictor = self._factory.get_predictor('churn')
        
        for size in batch_sizes:
            test_data = generate_test_data(size=size)
            
            start_time = time.time()
            predictions = await predictor.predict(test_data)
            latency = time.time() - start_time
            
            # Verify performance scales sub-linearly
            assert latency < PREDICTION_TIMEOUT
            assert len(predictions) == size
            
            self._metrics['latency'].append(latency)
    
    @pytest.mark.integration
    async def test_feature_importance_stability(self, generate_test_data):
        """Test feature importance stability across predictions."""
        test_data = generate_test_data(size=TEST_DATA_SIZE)
        model = ChurnModel(self._test_config)
        
        # Get feature importance for multiple runs
        importance_scores = []
        for _ in range(3):
            scores = model.get_feature_importance()
            importance_scores.append(scores)
        
        # Verify stability
        for feature in importance_scores[0].keys():
            feature_scores = [scores[feature] for scores in importance_scores]
            score_variance = np.var(feature_scores)
            assert score_variance < 0.1, f"Unstable importance for feature {feature}"