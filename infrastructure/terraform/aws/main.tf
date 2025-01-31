# Provider and Terraform Configuration
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws" # v5.0
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random" # v3.0
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket         = "${var.project_prefix}-${var.environment}-tfstate"
    key            = "terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    dynamodb_table = "${var.project_prefix}-${var.environment}-tflock"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    Environment = var.environment
    Project     = var.project_prefix
    ManagedBy   = "terraform"
  }
}

# KMS Key for Encryption
resource "aws_kms_key" "main" {
  description             = "KMS key for ${var.project_prefix}-${var.environment}"
  deletion_window_in_days = var.kms_key_deletion_window
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_prefix}-${var.environment}-kms"
  }
}

# VPC Module
module "vpc" {
  source = "./vpc"

  vpc_cidr            = var.vpc_cidr
  availability_zones  = var.availability_zones
  environment        = var.environment
  project_prefix     = var.project_prefix
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_prefix}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = var.ecs_container_insights ? "enabled" : "disabled"
  }

  tags = {
    Name = "${var.project_prefix}-${var.environment}-ecs"
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier        = "${var.project_prefix}-${var.environment}"
  engine            = "postgres"
  engine_version    = "15.3"
  instance_class    = var.rds_instance_class
  allocated_storage = 100
  
  multi_az               = var.rds_multi_az
  db_subnet_group_name   = module.vpc.database_subnet_group
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  backup_retention_period = var.backup_retention_days
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  storage_encrypted = true
  kms_key_id       = aws_kms_key.main.arn

  tags = {
    Name = "${var.project_prefix}-${var.environment}-rds"
  }
}

# ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${var.project_prefix}-${var.environment}"
  engine              = "redis"
  node_type           = var.elasticache_node_type
  num_cache_nodes     = var.elasticache_num_cache_nodes
  parameter_group_name = "default.redis7"
  port                = 6379
  
  subnet_group_name    = module.vpc.elasticache_subnet_group
  security_group_ids   = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                = aws_kms_key.main.arn

  tags = {
    Name = "${var.project_prefix}-${var.environment}-redis"
  }
}

# SageMaker Endpoint
resource "aws_sagemaker_endpoint_configuration" "main" {
  name = "${var.project_prefix}-${var.environment}"

  production_variants {
    variant_name           = "main"
    model_name            = aws_sagemaker_model.main.name
    instance_type         = var.sagemaker_instance_type
    initial_instance_count = var.sagemaker_autoscaling_min_capacity
  }

  tags = {
    Name = "${var.project_prefix}-${var.environment}-sagemaker"
  }
}

# S3 Buckets
resource "aws_s3_bucket" "data" {
  bucket = "${var.project_prefix}-${var.environment}-data"

  lifecycle_rule {
    enabled = true
    transition {
      days          = var.s3_lifecycle_glacier_transition_days
      storage_class = "GLACIER"
    }
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.main.arn
        sse_algorithm     = "aws:kms"
      }
    }
  }

  tags = {
    Name = "${var.project_prefix}-${var.environment}-data"
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  price_class         = var.cloudfront_price_class
  default_root_object = "index.html"

  origin {
    domain_name = aws_s3_bucket.data.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.data.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.data.id}"
    viewer_protocol_policy = "redirect-to-https"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_prefix}-${var.environment}-cf"
  }
}

# Outputs
output "vpc_id" {
  value = module.vpc.vpc_id
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "sagemaker_endpoint" {
  value = aws_sagemaker_endpoint_configuration.main.name
}