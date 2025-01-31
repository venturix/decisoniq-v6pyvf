"""
Unit tests for ML models validating prediction accuracy, feature importance, 
risk assessment, and performance metrics with comprehensive error handling and monitoring.

Dependencies:
- pytest==7.x
- numpy==1.24+
- pandas==2.x
- pytest-timeout==2.x
- pytest-mock==3.x
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from src.ml.models.churn import ChurnModel
from src.ml.models.risk import RiskModel, RISK_THRESHOLDS, RISK_FACTORS

# Test data constants
TEST_CUSTOMER_DATA = pd.DataFrame({
    'customer_id': ['C1', 'C2', 'C3', 'C4', 'C5'],
    'usage_metrics': [0.8, 0.3, 0.9, 0.4, 0.6],
    'engagement_score': [0.7, 0.4, 0.8, 0.3, 0.5],
    'support_tickets': [2, 5, 1, 4, 3],
    'contract_value': [10000, 5000, 15000, 7000, 9000],
    'product_adoption': [0.9, 0.4, 0.8, 0.5, 0.7],
    'interaction_frequency': [0.8, 0.3, 0.9, 0.4, 0.6]
})

MODEL_PERFORMANCE_THRESHOLDS = {
    'accuracy': 0.90,
    'false_positive_rate': 0.05,
    'feature_importance': 0.70,
    'prediction_time': 3.0,
    'drift_threshold': 0.10
}

@pytest.mark.unit
class TestMLModels:
    """Comprehensive test suite for ML model validation and monitoring."""

    def setup_method(self):
        """Setup method run before each test."""
        # Initialize model configurations
        self.churn_config = {
            'model_type': 'xgboost',
            'version': 'v1',
            'hyperparameters': {
                'max_depth': 6,
                'eta': 0.3,
                'objective': 'binary:logistic'
            },
            'metrics': {
                'accuracy_threshold': MODEL_PERFORMANCE_THRESHOLDS['accuracy'],
                'false_positive_threshold': MODEL_PERFORMANCE_THRESHOLDS['false_positive_rate'],
                'model_drift_threshold': MODEL_PERFORMANCE_THRESHOLDS['drift_threshold']
            }
        }

        self.risk_config = {
            'model_type': 'lightgbm',
            'version': 'v1',
            'hyperparameters': {
                'num_leaves': 31,
                'learning_rate': 0.05,
                'objective': 'binary'
            },
            'metrics': {
                'accuracy_threshold': MODEL_PERFORMANCE_THRESHOLDS['accuracy'],
                'false_positive_threshold': MODEL_PERFORMANCE_THRESHOLDS['false_positive_rate'],
                'model_drift_threshold': MODEL_PERFORMANCE_THRESHOLDS['drift_threshold']
            }
        }

        # Initialize models
        self.churn_model = ChurnModel(self.churn_config)
        self.risk_model = RiskModel()

        # Initialize test monitoring
        self.test_metrics = {
            'execution_time': [],
            'memory_usage': [],
            'prediction_latency': []
        }

    def teardown_method(self):
        """Cleanup method run after each test."""
        # Clear test data
        self.test_metrics = {
            'execution_time': [],
            'memory_usage': [],
            'prediction_latency': []
        }

    @pytest.mark.timeout(5)
    async def test_churn_model_prediction(self):
        """Test churn model prediction accuracy and performance."""
        # Prepare test data
        test_data = TEST_CUSTOMER_DATA.copy()
        
        # Generate predictions
        start_time = datetime.now()
        predictions = await self.churn_model.predict(test_data)
        execution_time = (datetime.now() - start_time).total_seconds()

        # Validate prediction format
        assert isinstance(predictions, pd.DataFrame)
        assert 'churn_probability' in predictions.columns
        assert 'confidence_score' in predictions.columns
        assert len(predictions) == len(test_data)

        # Validate prediction ranges
        assert all(0 <= p <= 1 for p in predictions['churn_probability'])
        assert all(0 <= c <= 1 for c in predictions['confidence_score'])

        # Validate performance
        assert execution_time < MODEL_PERFORMANCE_THRESHOLDS['prediction_time']
        self.test_metrics['prediction_latency'].append(execution_time)

        # Test error handling
        with pytest.raises(Exception):
            await self.churn_model.predict(pd.DataFrame())

    @pytest.mark.unit
    async def test_churn_model_feature_importance(self):
        """Test feature importance calculation and validation."""
        # Calculate feature importance
        feature_importance = await self.churn_model.get_feature_importance()

        # Validate feature importance format
        assert isinstance(feature_importance, dict)
        assert all(isinstance(score, float) for score in feature_importance.values())

        # Validate importance scores
        assert all(0 <= score <= 1 for score in feature_importance.values())
        assert any(score >= MODEL_PERFORMANCE_THRESHOLDS['feature_importance'] 
                  for score in feature_importance.values())

        # Validate key features
        key_features = ['usage_metrics', 'engagement_score', 'contract_value']
        assert all(feature in feature_importance for feature in key_features)

        # Test stability
        second_importance = await self.churn_model.get_feature_importance()
        assert feature_importance == second_importance

    @pytest.mark.unit
    async def test_risk_model_prediction(self):
        """Test risk assessment model predictions and factor analysis."""
        # Prepare test data
        test_data = TEST_CUSTOMER_DATA.copy()

        # Generate risk predictions
        start_time = datetime.now()
        risk_assessment = await self.risk_model.predict_risk(test_data)
        execution_time = (datetime.now() - start_time).total_seconds()

        # Validate risk assessment format
        assert isinstance(risk_assessment, dict)
        assert all(key in risk_assessment for key in 
                  ['risk_score', 'risk_level', 'confidence', 'risk_factors'])

        # Validate risk scores
        assert 0 <= risk_assessment['risk_score'] <= 1
        assert risk_assessment['risk_level'] in RISK_THRESHOLDS.keys()
        assert 0 <= risk_assessment['confidence'] <= 1

        # Validate risk factors
        assert isinstance(risk_assessment['risk_factors'], dict)
        assert 'importance_scores' in risk_assessment['risk_factors']
        assert 'primary_factors' in risk_assessment['risk_factors']
        assert 'recommendations' in risk_assessment['risk_factors']

        # Validate performance
        assert execution_time < MODEL_PERFORMANCE_THRESHOLDS['prediction_time']
        self.test_metrics['prediction_latency'].append(execution_time)

    @pytest.mark.unit
    async def test_risk_factor_analysis(self):
        """Test risk factor analysis and recommendations."""
        # Prepare test data
        test_features = pd.DataFrame({
            factor: [0.8] for factor in RISK_FACTORS
        })

        # Analyze risk factors
        risk_score = 0.85
        factor_analysis = await self.risk_model.analyze_risk_factors(
            test_features, risk_score
        )

        # Validate analysis format
        assert isinstance(factor_analysis, dict)
        assert all(key in factor_analysis for key in 
                  ['importance_scores', 'primary_factors', 'recommendations'])

        # Validate importance scores
        assert all(0 <= score <= 1 
                  for score in factor_analysis['importance_scores'].values())
        assert len(factor_analysis['primary_factors']) > 0

        # Validate recommendations
        assert isinstance(factor_analysis['recommendations'], list)
        assert len(factor_analysis['recommendations']) > 0

    @pytest.mark.unit
    async def test_model_drift_monitoring(self):
        """Test model drift detection and monitoring."""
        # Prepare historical and current data
        historical_data = TEST_CUSTOMER_DATA.copy()
        current_data = TEST_CUSTOMER_DATA.copy()
        current_data['usage_metrics'] *= 0.7  # Simulate drift

        # Calculate drift for churn model
        churn_predictions_historical = await self.churn_model.predict(historical_data)
        churn_predictions_current = await self.churn_model.predict(current_data)
        
        drift_metrics = await self.churn_model.evaluate(
            current_data,
            pd.Series([1, 0, 1, 0, 1])  # Mock labels
        )

        # Validate drift metrics
        assert isinstance(drift_metrics, dict)
        assert all(key in drift_metrics for key in ['accuracy', 'precision', 'recall', 'f1'])
        assert all(0 <= metric <= 1 for metric in drift_metrics.values())

        # Test drift threshold validation
        assert drift_metrics['accuracy'] >= MODEL_PERFORMANCE_THRESHOLDS['accuracy']

        # Test risk model drift
        risk_assessment_historical = await self.risk_model.predict_risk(historical_data)
        risk_assessment_current = await self.risk_model.predict_risk(current_data)

        # Validate risk drift
        assert abs(risk_assessment_current['risk_score'] - 
                  risk_assessment_historical['risk_score']) <= MODEL_PERFORMANCE_THRESHOLDS['drift_threshold']

    @pytest.mark.unit
    async def test_model_confidence_calculation(self):
        """Test confidence score calculation and validation."""
        # Prepare test data with varying quality
        high_quality_data = TEST_CUSTOMER_DATA.copy()
        low_quality_data = TEST_CUSTOMER_DATA.copy()
        low_quality_data.loc[0, 'usage_metrics'] = np.nan

        # Calculate confidence scores
        risk_score = 0.75
        high_quality_confidence = await self.risk_model.calculate_confidence(
            high_quality_data, risk_score
        )
        
        # Validate confidence scores
        assert isinstance(high_quality_confidence, float)
        assert 0 <= high_quality_confidence <= 1

        # Test confidence with extreme predictions
        extreme_risk_score = 0.95
        extreme_confidence = await self.risk_model.calculate_confidence(
            high_quality_data, extreme_risk_score
        )
        assert extreme_confidence < high_quality_confidence  # Should be lower for extreme predictions

        # Test error handling
        with pytest.raises(Exception):
            await self.risk_model.calculate_confidence(pd.DataFrame(), risk_score)