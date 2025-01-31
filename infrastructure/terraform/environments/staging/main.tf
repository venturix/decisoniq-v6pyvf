# Terraform configuration for Customer Success AI Platform staging environment
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws" # ~> 5.0
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random" # ~> 3.0
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket         = "customer-success-ai-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Provider configuration
provider "aws" {
  region = var.aws_region
  default_tags {
    Environment = var.environment
    Project     = "customer-success-ai"
    ManagedBy   = "terraform"
    CostCenter  = "staging-ops"
  }
}

# VPC Module
module "vpc" {
  source             = "../../aws/vpc"
  vpc_cidr           = var.vpc_cidr
  availability_zones = [var.availability_zones[0]] # Single AZ for staging
  environment        = var.environment
  enable_flow_logs   = true

  tags = {
    Name = "staging-cs-ai-vpc"
  }
}

# ECS Cluster
module "ecs" {
  source                    = "../../modules/ecs-service"
  cluster_name             = "staging-cs-ai-cluster"
  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnet_ids
  instance_type            = "t3.medium"
  min_capacity             = 1
  max_capacity             = 3
  desired_count            = var.ecs_desired_count
  target_cpu_utilization   = 70
  enable_container_insights = true
  environment              = var.environment

  tags = {
    Name = "staging-cs-ai-ecs"
  }
}

# RDS Database
module "rds" {
  source                      = "../../modules/rds"
  identifier                  = "staging-cs-ai-db"
  vpc_id                      = module.vpc.vpc_id
  subnet_ids                  = module.vpc.database_subnet_ids
  instance_class             = var.rds_instance_class
  allocated_storage          = var.rds_allocated_storage
  backup_retention_period    = var.backup_retention_period
  multi_az                   = false # Single AZ for staging
  enable_encryption         = true
  performance_insights_enabled = var.enable_performance_insights
  monitoring_interval        = var.monitoring_interval
  environment               = var.environment

  tags = {
    Name = "staging-cs-ai-rds"
  }
}

# Redis Cache
module "redis" {
  source                     = "../../modules/redis"
  cluster_id                = "staging-cs-ai-cache"
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.private_subnet_ids
  node_type                 = "cache.t3.medium"
  num_cache_nodes          = 1 # Single node for staging
  enable_encryption        = true
  automatic_failover_enabled = false
  environment              = var.environment

  tags = {
    Name = "staging-cs-ai-redis"
  }
}

# SageMaker
module "sagemaker" {
  source              = "../../aws/sagemaker"
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  instance_type       = "ml.t3.medium"
  enable_monitoring   = true
  monitoring_interval = 300
  endpoint_auto_scaling = false

  tags = {
    Name = "staging-cs-ai-sagemaker"
  }
}

# Security Group for Application
resource "aws_security_group" "app" {
  name        = "staging-cs-ai-app-sg"
  description = "Security group for staging application"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "staging-cs-ai-app-sg"
  }
}

# Outputs
output "vpc_id" {
  description = "VPC ID for staging environment"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "RDS endpoint for staging database"
  value       = module.rds.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint for staging cache"
  value       = module.redis.endpoint
  sensitive   = true
}

output "sagemaker_endpoint" {
  description = "SageMaker endpoint for staging ML model inference"
  value       = module.sagemaker.endpoint_name
  sensitive   = true
}