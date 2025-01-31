# Production Environment Terraform Configuration for Customer Success AI Platform
# Terraform version >= 1.5.0

terraform {
  required_version = ">= 1.5.0"
  
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
    key            = "production/terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    dynamodb_table = "customer-success-ai-terraform-locks"
    
    # Enhanced backend configuration for production
    versioning     = true
    kms_key_id     = "alias/terraform-state-key"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment        = "production"
      Project           = "customer-success-ai"
      ManagedBy         = "terraform"
      SecurityLevel     = "high"
      ComplianceRequired = "true"
      BackupRequired    = "true"
      CostCenter        = "cs-platform"
      DataClassification = "confidential"
    }
  }
}

# Production Infrastructure Module
module "core_infrastructure" {
  source = "../../aws"

  # Core Configuration
  environment         = "production"
  project_prefix      = "cs-ai-platform"
  aws_region         = var.aws_region
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  # Enhanced Production Security Configuration
  enable_encryption            = true
  kms_key_deletion_window     = 30
  enable_waf                  = true
  waf_rate_limit             = 2000
  enable_shield              = true
  enable_guardduty           = true
  enable_security_hub        = true
  enable_config             = true
  enable_cloudtrail         = true
  
  # High Availability Configuration
  multi_az                    = true
  cross_zone_load_balancing  = true
  ecs_container_insights     = true
  ecs_task_cpu              = 2048
  ecs_task_memory           = 4096
  ecs_desired_count         = 3
  ecs_min_capacity          = 2
  ecs_max_capacity          = 10

  # Database Configuration
  rds_instance_class              = "db.r6g.2xlarge"
  rds_multi_az                    = true
  backup_retention_days           = 30
  performance_insights_enabled    = true
  performance_insights_retention  = 7
  deletion_protection            = true
  
  # Caching Configuration
  elasticache_node_type          = "cache.r6g.xlarge"
  elasticache_num_cache_nodes    = 3
  
  # ML Infrastructure Configuration
  sagemaker_instance_type              = "ml.c5.2xlarge"
  sagemaker_autoscaling_min_capacity   = 2
  sagemaker_autoscaling_max_capacity   = 6

  # Monitoring Configuration
  alarm_evaluation_periods = 3
  alarm_period_seconds    = 300
  enhanced_monitoring     = true
  monitoring_interval     = 30

  # Storage Configuration
  s3_lifecycle_glacier_transition_days = 90
  
  # CDN Configuration
  cloudfront_price_class = "PriceClass_All"
}

# Production Outputs
output "vpc_id" {
  description = "Production VPC ID"
  value       = module.core_infrastructure.vpc_id
}

output "rds_endpoint" {
  description = "Production RDS endpoint"
  value       = module.core_infrastructure.rds_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Production Redis endpoint"
  value       = module.core_infrastructure.redis_endpoint
  sensitive   = true
}

output "sagemaker_endpoint" {
  description = "Production SageMaker endpoint"
  value       = module.core_infrastructure.sagemaker_endpoint
  sensitive   = true
}

output "cloudfront_distribution_id" {
  description = "Production CloudFront distribution ID"
  value       = module.core_infrastructure.cloudfront_distribution_id
}

output "ecs_cluster_arn" {
  description = "Production ECS cluster ARN"
  value       = module.core_infrastructure.ecs_cluster_arn
}

output "kms_key_arn" {
  description = "Production KMS key ARN"
  value       = module.core_infrastructure.kms_key_arn
  sensitive   = true
}

output "waf_web_acl_arn" {
  description = "Production WAF web ACL ARN"
  value       = module.core_infrastructure.waf_web_acl_arn
}