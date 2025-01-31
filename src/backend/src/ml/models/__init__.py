"""
Initialization module for ML models package that exports predictive models for customer churn,
expansion opportunities, health scoring, and risk assessment with enhanced logging, validation,
and monitoring capabilities.

Dependencies:
- logging==3.11+
- importlib==3.11+
- functools==3.11+
"""

import logging
import importlib
import functools
from typing import Dict, Any, List

# Configure module logger
logger = logging.getLogger(__name__)

# Global constants
MODEL_VERSION: str = '1.0.0'
REQUIRED_ACCURACY: float = 0.90
MAX_PREDICTION_LATENCY: float = 3.0

# Import model classes with validation
from .churn import ChurnModel
from .expansion import ExpansionModel
from .health import CustomerHealthModel as HealthModel
from .risk import RiskModel

@functools.lru_cache(maxsize=1)
def validate_model_imports(model_classes: Dict[str, Any]) -> bool:
    """
    Validates that all required model classes and their methods are properly imported.
    
    Args:
        model_classes: Dictionary of model classes to validate
        
    Returns:
        True if all imports are valid, False otherwise
    """
    try:
        required_methods = {
            'ChurnModel': ['prepare_features', 'predict'],
            'ExpansionModel': ['prepare_features', 'predict'],
            'HealthModel': ['predict', 'compute_health_metrics'],
            'RiskModel': ['predict', 'get_feature_importance']
        }
        
        # Validate each model class
        for class_name, methods in required_methods.items():
            if class_name not in model_classes:
                logger.error(f"Required model class not found: {class_name}")
                return False
                
            model_class = model_classes[class_name]
            for method in methods:
                if not hasattr(model_class, method):
                    logger.error(f"Required method {method} not found in {class_name}")
                    return False
                    
            logger.info(f"Successfully validated {class_name} with methods: {methods}")
            
        return True
        
    except Exception as e:
        logger.error(f"Model import validation failed: {str(e)}")
        return False

def initialize_logging() -> None:
    """
    Configures enhanced logging for model operations and performance tracking.
    """
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Add performance metrics handler
    performance_handler = logging.FileHandler('model_performance.log')
    performance_handler.setLevel(logging.INFO)
    performance_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    performance_handler.setFormatter(performance_formatter)
    logger.addHandler(performance_handler)
    
    logger.info(f"ML models package initialized - Version {MODEL_VERSION}")

# Initialize logging
initialize_logging()

# Validate model imports
model_classes = {
    'ChurnModel': ChurnModel,
    'ExpansionModel': ExpansionModel,
    'HealthModel': HealthModel,
    'RiskModel': RiskModel
}

if not validate_model_imports(model_classes):
    raise ImportError("Failed to validate required model imports")

# Export model classes
__all__ = [
    'ChurnModel',
    'ExpansionModel', 
    'HealthModel',
    'RiskModel',
    'MODEL_VERSION',
    'REQUIRED_ACCURACY',
    'MAX_PREDICTION_LATENCY'
]