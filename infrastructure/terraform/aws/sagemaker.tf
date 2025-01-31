# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# S3 bucket for model artifacts and data capture
resource "aws_s3_bucket" "model_data" {
  bucket = "${var.project_prefix}-${var.environment}-sagemaker-data"

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-sagemaker-data"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "model_data" {
  bucket = aws_s3_bucket.model_data.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_key_arn
      sse_algorithm     = "aws:kms"
    }
  }
}

# IAM role for SageMaker execution
resource "aws_iam_role" "sagemaker_execution_role" {
  name = "${var.project_prefix}-${var.environment}-sagemaker-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-sagemaker-role"
    Environment = var.environment
  }
}

# IAM policy for SageMaker execution role
resource "aws_iam_role_policy" "sagemaker_execution_policy" {
  name = "${var.project_prefix}-${var.environment}-sagemaker-policy"
  role = aws_iam_role.sagemaker_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.model_data.arn,
          "${aws_s3_bucket.model_data.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [var.kms_key_arn]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# Security group for SageMaker endpoints
resource "aws_security_group" "sagemaker_sg" {
  name        = "${var.project_prefix}-${var.environment}-sagemaker-sg"
  description = "Security group for SageMaker endpoints"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = []  # Will be populated by application security groups
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-sagemaker-sg"
    Environment = var.environment
  }
}

# SageMaker model resource
resource "aws_sagemaker_model" "main" {
  name               = "${var.project_prefix}-${var.environment}-model"
  execution_role_arn = aws_iam_role.sagemaker_execution_role.arn

  primary_container {
    image = "${data.aws_ecr_repository.model_repository.repository_url}:latest"
    mode  = "SingleModel"
    environment = {
      SAGEMAKER_PROGRAM           = "inference.py"
      SAGEMAKER_SUBMIT_DIRECTORY  = "/opt/ml/model/code"
      SAGEMAKER_CONTAINER_LOG_LEVEL = "INFO"
      MODEL_VERSION               = "1.0"
      MONITORING_ENABLED          = "true"
    }
    model_data_url = "s3://${aws_s3_bucket.model_data.bucket}/models/latest/model.tar.gz"
  }

  vpc_config {
    subnets            = var.private_subnet_ids
    security_group_ids = [aws_security_group.sagemaker_sg.id]
  }

  enable_network_isolation = true

  tags = {
    Name          = "${var.project_prefix}-${var.environment}-model"
    Environment   = var.environment
    Version       = "1.0"
    SecurityScan  = "approved"
  }
}

# SageMaker endpoint configuration
resource "aws_sagemaker_endpoint_configuration" "main" {
  name = "${var.project_prefix}-${var.environment}-endpoint-config"

  production_variants {
    variant_name           = "Primary"
    model_name            = aws_sagemaker_model.main.name
    initial_instance_count = 2
    instance_type         = "ml.c5.xlarge"
    initial_variant_weight = 1.0

    serverless_config {
      max_concurrency     = 50
      memory_size_in_mb   = 2048
    }
  }

  data_capture_config {
    enable_capture = true
    destination_s3_uri = "s3://${aws_s3_bucket.model_data.bucket}/datacapture"
    initial_sampling_percentage = 100
    capture_options {
      capture_mode = "Input"
    }
    capture_options {
      capture_mode = "Output"
    }
    kms_key_id = var.kms_key_arn
  }

  async_inference_config {
    output_config {
      s3_output_path = "s3://${aws_s3_bucket.model_data.bucket}/async-results"
      kms_key_id     = var.kms_key_arn
    }
  }

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-endpoint-config"
    Environment = var.environment
    AutoScaling = "enabled"
    Monitoring  = "enhanced"
  }
}

# SageMaker endpoint
resource "aws_sagemaker_endpoint" "main" {
  name                 = "${var.project_prefix}-${var.environment}-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.main.name

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-endpoint"
    Environment = var.environment
  }
}

# Auto-scaling configuration for the endpoint
resource "aws_appautoscaling_target" "sagemaker_target" {
  max_capacity       = var.sagemaker_autoscaling_max_capacity
  min_capacity       = var.sagemaker_autoscaling_min_capacity
  resource_id        = "endpoint/${aws_sagemaker_endpoint.main.name}/variant/Primary"
  scalable_dimension = "sagemaker:variant:DesiredInstanceCount"
  service_namespace  = "sagemaker"
}

resource "aws_appautoscaling_policy" "sagemaker_scale_up" {
  name               = "${var.project_prefix}-${var.environment}-sagemaker-scale-up"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.sagemaker_target.resource_id
  scalable_dimension = aws_appautoscaling_target.sagemaker_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.sagemaker_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 75.0
    predefined_metric_specification {
      predefined_metric_type = "SageMakerVariantInvocationsPerInstance"
    }
  }
}

# Outputs
output "sagemaker_endpoint_name" {
  description = "SageMaker endpoint name for ML model inference"
  value       = aws_sagemaker_endpoint.main.name
}

output "sagemaker_model_name" {
  description = "SageMaker model name for reference"
  value       = aws_sagemaker_model.main.name
}

output "sagemaker_security_group_id" {
  description = "Security group ID for SageMaker resources"
  value       = aws_security_group.sagemaker_sg.id
}

output "sagemaker_data_capture_config" {
  description = "Data capture configuration for model monitoring"
  value = {
    destination_s3_uri    = "${aws_s3_bucket.model_data.bucket}/datacapture"
    sampling_percentage   = 100
  }
}