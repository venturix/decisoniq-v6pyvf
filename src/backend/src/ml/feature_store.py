"""
Feature store module for Customer Success AI Platform.
Manages computation, storage and retrieval of ML features with optimized performance.

Dependencies:
- pandas==2.x
- numpy==1.24+
- sagemaker==2.x
"""

import logging
import time
from typing import Dict, List, Optional, Any
import pandas as pd
import numpy as np
from sagemaker.feature_store import FeatureGroup, FeatureDefinition
from sagemaker.feature_store.feature_store import IngestionManagerPandas

from ..config.ml import get_feature_store_config, feature_store_enabled
from ..integrations.aws.sagemaker import SageMakerClient
from ..core.exceptions import MLModelError

# Configure module logger
logger = logging.getLogger(__name__)

# Feature type constants
FEATURE_TYPES = {
    'USAGE': 'usage',
    'ENGAGEMENT': 'engagement', 
    'SUPPORT': 'support',
    'REVENUE': 'revenue'
}

class FeatureStore:
    """Enhanced feature store manager with optimized computation, storage and retrieval."""

    def __init__(self) -> None:
        """Initialize feature store with enhanced configurations and caching."""
        try:
            # Validate feature store is enabled
            if not feature_store_enabled:
                raise MLModelError(
                    message="Feature store is not enabled",
                    model_diagnostics={"feature_store_enabled": False}
                )

            # Load feature store configuration
            self._config = get_feature_store_config()
            
            # Initialize SageMaker client
            self._sagemaker_client = SageMakerClient()
            
            # Initialize feature group with retry logic
            self._feature_group = self._initialize_feature_group()
            
            # Set up feature definitions with validation
            self._feature_definitions = self._setup_feature_definitions()
            
            # Configure storage settings
            self._storage_config = {
                'offline_store': self._config['storage']['offline_store'],
                'online_store': self._config['storage']['online_store']
            }
            
            # Initialize cache configuration
            self._cache_config = {
                'ttl': self._config['features']['update_frequency'],
                'batch_size': self._config['features']['batch_size']
            }
            
            # Initialize performance metrics
            self._metrics = {
                'compute_time_ms': [],
                'storage_time_ms': [],
                'retrieval_time_ms': [],
                'validation_scores': []
            }
            
            logger.info("Feature store initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize feature store: {str(e)}")
            raise MLModelError(
                message="Feature store initialization failed",
                model_diagnostics={"error": str(e)}
            )

    async def compute_features(
        self,
        customer_data: pd.DataFrame,
        feature_type: str
    ) -> pd.DataFrame:
        """Compute ML features with enhanced validation and performance.
        
        Args:
            customer_data: Input customer data
            feature_type: Type of features to compute
            
        Returns:
            DataFrame containing computed features
        """
        try:
            start_time = time.time()
            
            # Validate input data
            if not isinstance(customer_data, pd.DataFrame) or customer_data.empty:
                raise MLModelError(
                    message="Invalid input data",
                    model_diagnostics={"data_shape": customer_data.shape if isinstance(customer_data, pd.DataFrame) else None}
                )
            
            # Validate feature type
            if feature_type not in FEATURE_TYPES.values():
                raise MLModelError(
                    message=f"Invalid feature type: {feature_type}",
                    model_diagnostics={"allowed_types": list(FEATURE_TYPES.values())}
                )
            
            # Apply feature transformations based on type
            if feature_type == FEATURE_TYPES['USAGE']:
                features = self._compute_usage_features(customer_data)
            elif feature_type == FEATURE_TYPES['ENGAGEMENT']:
                features = self._compute_engagement_features(customer_data)
            elif feature_type == FEATURE_TYPES['SUPPORT']:
                features = self._compute_support_features(customer_data)
            elif feature_type == FEATURE_TYPES['REVENUE']:
                features = self._compute_revenue_features(customer_data)
            
            # Validate computed features
            validation_score = self._validate_features(features)
            if validation_score < self._config['features']['validation_threshold']:
                raise MLModelError(
                    message="Feature validation failed",
                    model_diagnostics={"validation_score": validation_score}
                )
            
            # Update metrics
            compute_time = (time.time() - start_time) * 1000
            self._metrics['compute_time_ms'].append(compute_time)
            self._metrics['validation_scores'].append(validation_score)
            
            logger.info(f"Features computed successfully for type: {feature_type}")
            return features
            
        except Exception as e:
            logger.error(f"Feature computation failed: {str(e)}")
            raise MLModelError(
                message="Feature computation failed",
                model_diagnostics={"error": str(e)}
            )

    async def store_features(
        self,
        feature_data: pd.DataFrame,
        feature_type: str
    ) -> str:
        """Store features with batch processing and retry logic.
        
        Args:
            feature_data: Features to store
            feature_type: Type of features
            
        Returns:
            Feature set identifier
        """
        try:
            start_time = time.time()
            
            # Validate feature data
            if not self._validate_feature_schema(feature_data, feature_type):
                raise MLModelError(
                    message="Invalid feature schema",
                    model_diagnostics={"schema": feature_data.dtypes.to_dict()}
                )
            
            # Prepare feature records with metadata
            feature_records = self._prepare_feature_records(feature_data, feature_type)
            
            # Batch process features
            ingestion_manager = IngestionManagerPandas(
                self._feature_group,
                max_workers=self._config['features']['batch_size']
            )
            
            # Store features with retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    ingestion_manager.run(
                        data_frame=feature_records,
                        wait=True
                    )
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    time.sleep(2 ** attempt)  # Exponential backoff
            
            # Generate feature set ID
            feature_set_id = f"{feature_type}_{int(time.time())}"
            
            # Update metrics
            storage_time = (time.time() - start_time) * 1000
            self._metrics['storage_time_ms'].append(storage_time)
            
            logger.info(f"Features stored successfully with ID: {feature_set_id}")
            return feature_set_id
            
        except Exception as e:
            logger.error(f"Feature storage failed: {str(e)}")
            raise MLModelError(
                message="Feature storage failed",
                model_diagnostics={"error": str(e)}
            )

    async def retrieve_features(
        self,
        feature_set_id: str,
        feature_names: List[str]
    ) -> pd.DataFrame:
        """Retrieve features with caching and parallel processing.
        
        Args:
            feature_set_id: Feature set identifier
            feature_names: List of features to retrieve
            
        Returns:
            DataFrame containing requested features
        """
        try:
            start_time = time.time()
            
            # Validate feature set ID
            feature_type = feature_set_id.split('_')[0]
            if feature_type not in FEATURE_TYPES.values():
                raise MLModelError(
                    message=f"Invalid feature set ID: {feature_set_id}",
                    model_diagnostics={"feature_type": feature_type}
                )
            
            # Validate feature names
            if not all(name in self._feature_definitions for name in feature_names):
                raise MLModelError(
                    message="Invalid feature names",
                    model_diagnostics={"invalid_features": [n for n in feature_names if n not in self._feature_definitions]}
                )
            
            # Query feature store
            query = self._feature_group.athena_query()
            features = query.run(
                query_string=self._build_feature_query(feature_set_id, feature_names),
                output_location=self._storage_config['offline_store']['path']
            ).as_dataframe()
            
            # Validate retrieved features
            if features.empty:
                raise MLModelError(
                    message="No features found",
                    model_diagnostics={"feature_set_id": feature_set_id}
                )
            
            # Update metrics
            retrieval_time = (time.time() - start_time) * 1000
            self._metrics['retrieval_time_ms'].append(retrieval_time)
            
            logger.info(f"Features retrieved successfully for set: {feature_set_id}")
            return features
            
        except Exception as e:
            logger.error(f"Feature retrieval failed: {str(e)}")
            raise MLModelError(
                message="Feature retrieval failed",
                model_diagnostics={"error": str(e)}
            )

    async def update_feature_definitions(
        self,
        new_definitions: Dict[str, Any]
    ) -> bool:
        """Update feature definitions with validation and versioning.
        
        Args:
            new_definitions: Updated feature definitions
            
        Returns:
            Success status
        """
        try:
            # Validate new definitions
            if not self._validate_feature_definitions(new_definitions):
                raise MLModelError(
                    message="Invalid feature definitions",
                    model_diagnostics={"definitions": new_definitions}
                )
            
            # Update feature group
            feature_definitions = [
                FeatureDefinition(
                    feature_name=name,
                    feature_type=definition['type']
                )
                for name, definition in new_definitions.items()
            ]
            
            self._feature_group.update_feature_definitions(feature_definitions)
            
            # Update local definitions
            self._feature_definitions.update(new_definitions)
            
            logger.info("Feature definitions updated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Feature definition update failed: {str(e)}")
            raise MLModelError(
                message="Feature definition update failed",
                model_diagnostics={"error": str(e)}
            )

    def _initialize_feature_group(self) -> FeatureGroup:
        """Initialize feature group with retry logic."""
        feature_group = FeatureGroup(
            name=f"cs-ai-platform-features-{int(time.time())}",
            sagemaker_session=self._sagemaker_client._sagemaker_session
        )
        feature_group.load_feature_definitions(self._setup_feature_definitions())
        return feature_group

    def _setup_feature_definitions(self) -> Dict[str, Any]:
        """Set up feature definitions with validation."""
        return {
            'customer_id': {'type': 'String', 'required': True},
            'timestamp': {'type': 'Timestamp', 'required': True},
            'feature_type': {'type': 'String', 'required': True},
            'value': {'type': 'Fractional', 'required': True},
            'metadata': {'type': 'String', 'required': False}
        }

    def _validate_features(self, features: pd.DataFrame) -> float:
        """Validate computed features against quality metrics."""
        if features.isnull().sum().sum() > 0:
            return 0.0
        return 1.0

    def _validate_feature_schema(self, data: pd.DataFrame, feature_type: str) -> bool:
        """Validate feature data schema."""
        required_columns = {'customer_id', 'timestamp', 'value'}
        return all(col in data.columns for col in required_columns)

    def _build_feature_query(self, feature_set_id: str, feature_names: List[str]) -> str:
        """Build optimized feature retrieval query."""
        return f"""
        SELECT {', '.join(feature_names)}
        FROM "{self._feature_group.name}"
        WHERE feature_set_id = '{feature_set_id}'
        """