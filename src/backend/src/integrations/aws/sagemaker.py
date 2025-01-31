"""
AWS SageMaker integration module for Customer Success AI Platform.
Handles ML model deployment, training, and inference operations with optimized performance.

Dependencies:
- boto3==1.28+
- sagemaker==2.x
- numpy==1.24+
"""

import logging
import time
from typing import Dict, Any, Optional
import boto3
import sagemaker
import numpy as np
from sagemaker.predictor import Predictor
from sagemaker.serializers import NumpySerializer
from sagemaker.deserializers import NumpyDeserializer

from ...config.aws import sagemaker_config, get_boto3_session
from ...config.ml import get_model_config, get_training_config, get_prediction_config
from ...core.exceptions import MLModelError
from ...core.cache import cache_manager

# Configure module logger
logger = logging.getLogger(__name__)

# Constants for performance optimization
PREDICTION_TIMEOUT = 3.0  # 3 seconds SLA for predictions
CACHE_TTL = 300  # 5 minutes cache TTL

class SageMakerClient:
    """Enhanced client for AWS SageMaker operations with optimized performance and reliability."""

    def __init__(self) -> None:
        """Initialize SageMaker client with optimized configurations."""
        try:
            # Initialize AWS session with optimized timeouts
            self._session = get_boto3_session()
            
            # Set up SageMaker session with performance configurations
            self._sagemaker_session = sagemaker.Session(
                boto_session=self._session,
                default_bucket=sagemaker_config['endpoint_config']['variant_name']
            )
            
            # Initialize endpoint configurations
            self._endpoint_configs = {}
            
            # Load model configurations
            self._model_configs = {}
            
            # Initialize cache manager
            self._cache_manager = cache_manager
            
            # Initialize health metrics
            self._health_metrics = {
                'predictions': {'count': 0, 'errors': 0, 'latency': []},
                'deployments': {'count': 0, 'errors': 0},
                'training': {'count': 0, 'errors': 0}
            }
            
            logger.info("SageMaker client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize SageMaker client: {str(e)}")
            raise MLModelError(
                message="SageMaker client initialization failed",
                model_diagnostics={"error": str(e)}
            )

    async def deploy_model(self, model_name: str, model_artifact_path: str, 
                         model_config: Dict[str, Any]) -> str:
        """Deploy model to SageMaker endpoint with optimization and monitoring.
        
        Args:
            model_name: Name of the model
            model_artifact_path: S3 path to model artifacts
            model_config: Model configuration parameters
            
        Returns:
            Endpoint name where model is deployed
        """
        try:
            # Validate model artifacts
            if not await self._validate_model_artifacts(model_artifact_path):
                raise MLModelError(
                    message="Invalid model artifacts",
                    model_diagnostics={"artifact_path": model_artifact_path}
                )

            # Configure model with optimized settings
            model = sagemaker.Model(
                model_data=model_artifact_path,
                role=sagemaker_config['role'],
                framework_version=model_config.get('framework_version'),
                py_version='py39',
                sagemaker_session=self._sagemaker_session,
                name=model_name,
                enable_network_isolation=True,
                model_environment={
                    'SAGEMAKER_MODEL_SERVER_TIMEOUT': str(int(PREDICTION_TIMEOUT * 1000)),
                    'SAGEMAKER_MODEL_SERVER_WORKERS': str(sagemaker_config['inference']['max_concurrent_invocations'])
                }
            )

            # Configure endpoint with auto-scaling
            endpoint_config = {
                'EndpointConfigName': f"{model_name}-config",
                'ProductionVariants': [{
                    'VariantName': sagemaker_config['endpoint_config']['variant_name'],
                    'ModelName': model_name,
                    'InstanceType': sagemaker_config['endpoint_config']['instance_type'],
                    'InitialInstanceCount': sagemaker_config['endpoint_config']['initial_instance_count'],
                    'VolumeSizeInGB': 30,
                    'ModelDataDownloadTimeoutInSeconds': 1200,
                    'ContainerStartupHealthCheckTimeoutInSeconds': 600
                }]
            }

            # Deploy with health monitoring
            endpoint_name = f"{model_name}-endpoint"
            model.deploy(
                endpoint_name=endpoint_name,
                endpoint_config_name=endpoint_config['EndpointConfigName'],
                tags=[{'Key': 'Environment', 'Value': 'production'}],
                wait=True
            )

            # Configure auto-scaling
            self._configure_autoscaling(endpoint_name)

            # Verify endpoint health
            if not await self._verify_endpoint_health(endpoint_name):
                raise MLModelError(
                    message="Endpoint health check failed",
                    model_diagnostics={"endpoint": endpoint_name}
                )

            self._health_metrics['deployments']['count'] += 1
            logger.info(f"Model {model_name} deployed successfully to endpoint {endpoint_name}")
            return endpoint_name

        except Exception as e:
            self._health_metrics['deployments']['errors'] += 1
            logger.error(f"Model deployment failed: {str(e)}")
            raise MLModelError(
                message="Model deployment failed",
                model_diagnostics={"error": str(e)}
            )

    async def train_model(self, job_name: str, training_data_path: str, 
                         training_config: Dict[str, Any]) -> str:
        """Train model using distributed SageMaker training with monitoring.
        
        Args:
            job_name: Training job name
            training_data_path: S3 path to training data
            training_config: Training configuration parameters
            
        Returns:
            Path to trained model artifact
        """
        try:
            # Get optimized training configuration
            config = get_training_config()
            
            # Configure distributed training
            distribution = {
                'mpi': {
                    'enabled': True,
                    'processes_per_host': config['compute']['instance_count']
                }
            }

            # Initialize estimator with performance optimizations
            estimator = sagemaker.estimator.Estimator(
                role=sagemaker_config['role'],
                instance_count=config['compute']['instance_count'],
                instance_type=config['compute']['instance_type'],
                volume_size=config['compute']['volume_size_gb'],
                max_run=config['schedule']['timeout_seconds'],
                input_mode='FastFile',
                output_path=f"s3://{self._sagemaker_session.default_bucket()}/models",
                sagemaker_session=self._sagemaker_session,
                distribution=distribution,
                metric_definitions=[
                    {'Name': 'train:error', 'Regex': 'train_error: ([0-9\\.]+)'},
                    {'Name': 'validation:error', 'Regex': 'validation_error: ([0-9\\.]+)'}
                ],
                enable_network_isolation=True,
                enable_sagemaker_metrics=True
            )

            # Configure hyperparameters
            estimator.set_hyperparameters(**training_config.get('hyperparameters', {}))

            # Start training job with monitoring
            estimator.fit(
                inputs={'training': training_data_path},
                job_name=job_name,
                wait=True,
                logs='All'
            )

            # Validate training results
            if not await self._validate_training_results(job_name):
                raise MLModelError(
                    message="Training validation failed",
                    model_diagnostics={"job_name": job_name}
                )

            self._health_metrics['training']['count'] += 1
            model_artifact_path = estimator.model_data
            logger.info(f"Training job {job_name} completed successfully")
            return model_artifact_path

        except Exception as e:
            self._health_metrics['training']['errors'] += 1
            logger.error(f"Training job failed: {str(e)}")
            raise MLModelError(
                message="Model training failed",
                model_diagnostics={"error": str(e)}
            )

    async def get_prediction(self, endpoint_name: str, input_data: np.ndarray) -> Dict[str, Any]:
        """Get optimized predictions from deployed model endpoint with caching.
        
        Args:
            endpoint_name: Name of the endpoint
            input_data: Input data for prediction
            
        Returns:
            Model predictions with confidence scores and latency metrics
        """
        try:
            # Check prediction cache
            cache_key = f"pred:{endpoint_name}:{hash(input_data.tobytes())}"
            cached_result = await self._cache_manager.get(cache_key)
            if cached_result:
                return cached_result

            # Initialize predictor with optimized settings
            predictor = Predictor(
                endpoint_name=endpoint_name,
                sagemaker_session=self._sagemaker_session,
                serializer=NumpySerializer(),
                deserializer=NumpyDeserializer(),
                content_type='application/x-npy'
            )

            # Make prediction with timeout
            start_time = time.time()
            prediction = predictor.predict(
                input_data,
                initial_args={'MaxConcurrentInvocations': sagemaker_config['inference']['max_concurrent_invocations']}
            )
            latency = (time.time() - start_time) * 1000

            # Validate prediction latency
            if latency > PREDICTION_TIMEOUT * 1000:
                logger.warning(f"Prediction latency ({latency}ms) exceeded SLA ({PREDICTION_TIMEOUT * 1000}ms)")

            # Format response
            result = {
                'prediction': prediction.tolist(),
                'confidence': float(np.max(prediction)),
                'latency_ms': latency
            }

            # Update cache and metrics
            await self._cache_manager.set(cache_key, result, 'prediction', {'ttl': CACHE_TTL})
            self._update_prediction_metrics(latency)

            return result

        except Exception as e:
            self._health_metrics['predictions']['errors'] += 1
            logger.error(f"Prediction failed: {str(e)}")
            raise MLModelError(
                message="Model prediction failed",
                model_diagnostics={"error": str(e)}
            )

    async def update_endpoint(self, endpoint_name: str, new_model_name: str, 
                            model_config: Dict[str, Any]) -> bool:
        """Update existing endpoint with zero-downtime deployment.
        
        Args:
            endpoint_name: Name of the endpoint to update
            new_model_name: Name of the new model version
            model_config: Model configuration parameters
            
        Returns:
            Success status of update operation
        """
        try:
            # Create new endpoint configuration
            new_config_name = f"{new_model_name}-config-{int(time.time())}"
            
            # Configure blue-green deployment
            variant_props = {
                'VariantName': sagemaker_config['endpoint_config']['variant_name'],
                'ModelName': new_model_name,
                'InstanceType': sagemaker_config['endpoint_config']['instance_type'],
                'InitialInstanceCount': sagemaker_config['endpoint_config']['initial_instance_count'],
                'InitialVariantWeight': 0.0
            }

            # Create new endpoint configuration
            self._sagemaker_session.create_endpoint_config(
                EndpointConfigName=new_config_name,
                ProductionVariants=[variant_props]
            )

            # Update endpoint with zero downtime
            self._sagemaker_session.update_endpoint(
                EndpointName=endpoint_name,
                EndpointConfigName=new_config_name,
                RetainAllVariantProperties=True
            )

            # Wait for deployment and health check
            if not await self._verify_endpoint_health(endpoint_name):
                raise MLModelError(
                    message="Endpoint update health check failed",
                    model_diagnostics={"endpoint": endpoint_name}
                )

            # Clean up old endpoint configuration
            old_config = self._endpoint_configs.get(endpoint_name)
            if old_config:
                self._sagemaker_session.delete_endpoint_config(
                    EndpointConfigName=old_config
                )

            self._endpoint_configs[endpoint_name] = new_config_name
            logger.info(f"Endpoint {endpoint_name} updated successfully")
            return True

        except Exception as e:
            logger.error(f"Endpoint update failed: {str(e)}")
            raise MLModelError(
                message="Endpoint update failed",
                model_diagnostics={"error": str(e)}
            )

    async def _validate_model_artifacts(self, artifact_path: str) -> bool:
        """Validate model artifacts before deployment."""
        try:
            s3 = self._session.client('s3')
            bucket, key = artifact_path.replace('s3://', '').split('/', 1)
            s3.head_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False

    def _configure_autoscaling(self, endpoint_name: str) -> None:
        """Configure auto-scaling for endpoint."""
        client = self._session.client('application-autoscaling')
        
        # Register scalable target
        client.register_scalable_target(
            ServiceNamespace='sagemaker',
            ResourceId=f"endpoint/{endpoint_name}/variant/{sagemaker_config['endpoint_config']['variant_name']}",
            ScalableDimension='sagemaker:variant:DesiredInstanceCount',
            MinCapacity=sagemaker_config['endpoint_config']['autoscaling']['min_capacity'],
            MaxCapacity=sagemaker_config['endpoint_config']['autoscaling']['max_capacity']
        )

        # Configure scaling policy
        client.put_scaling_policy(
            PolicyName=f"{endpoint_name}-scaling-policy",
            ServiceNamespace='sagemaker',
            ResourceId=f"endpoint/{endpoint_name}/variant/{sagemaker_config['endpoint_config']['variant_name']}",
            ScalableDimension='sagemaker:variant:DesiredInstanceCount',
            PolicyType='TargetTrackingScaling',
            TargetTrackingScalingPolicyConfiguration={
                'TargetValue': sagemaker_config['endpoint_config']['autoscaling']['target_value'],
                'PredefinedMetricSpecification': {
                    'PredefinedMetricType': 'SageMakerVariantInvocationsPerInstance'
                },
                'ScaleInCooldown': sagemaker_config['endpoint_config']['autoscaling']['scale_in_cooldown'],
                'ScaleOutCooldown': sagemaker_config['endpoint_config']['autoscaling']['scale_out_cooldown']
            }
        )

    async def _verify_endpoint_health(self, endpoint_name: str) -> bool:
        """Verify endpoint health after deployment."""
        try:
            client = self._session.client('sagemaker')
            waiter = client.get_waiter('endpoint_in_service')
            waiter.wait(
                EndpointName=endpoint_name,
                WaiterConfig={'Delay': 30, 'MaxAttempts': 20}
            )
            
            # Make test prediction
            test_input = np.zeros((1, 10), dtype=np.float32)
            await self.get_prediction(endpoint_name, test_input)
            return True
        except Exception:
            return False

    async def _validate_training_results(self, job_name: str) -> bool:
        """Validate training job results."""
        try:
            client = self._session.client('sagemaker')
            response = client.describe_training_job(TrainingJobName=job_name)
            return response['TrainingJobStatus'] == 'Completed'
        except Exception:
            return False

    def _update_prediction_metrics(self, latency: float) -> None:
        """Update prediction performance metrics."""
        self._health_metrics['predictions']['count'] += 1
        self._health_metrics['predictions']['latency'].append(latency)
        
        # Keep only last 1000 latency measurements
        if len(self._health_metrics['predictions']['latency']) > 1000:
            self._health_metrics['predictions']['latency'] = self._health_metrics['predictions']['latency'][-1000:]