# Production Environment Configuration for Customer Success AI Platform
# Terraform version ~> 1.5.0

# Core Environment Settings
environment                         = "production"
aws_region                         = "us-west-2"
availability_zones                 = ["us-west-2a", "us-west-2b", "us-west-2c"]

# VPC Configuration
vpc_cidr                          = "10.0.0.0/16"

# ECS Cluster Configuration
ecs_cluster_name                  = "cs-ai-platform-prod"
container_insights                = true
ecs_desired_count                 = 3
ecs_min_capacity                  = 2
ecs_max_capacity                  = 10
ecs_task_cpu                      = 2048
ecs_task_memory                   = 4096

# RDS Configuration
rds_instance_class                = "db.r6g.2xlarge"
rds_allocated_storage            = 100
rds_multi_az                     = true
backup_retention_period          = 30
monitoring_interval              = 30
performance_insights_retention_period = 7

# ElastiCache Configuration
elasticache_node_type            = "cache.r6g.xlarge"
elasticache_num_cache_nodes      = 3

# SageMaker Configuration
sagemaker_instance_type          = "ml.c5.2xlarge"
sagemaker_autoscaling_min_capacity = 2
sagemaker_autoscaling_max_capacity = 6

# Security Configuration
kms_key_deletion_window          = 30
waf_rate_limit                   = 2000

# Monitoring Configuration
alarm_evaluation_periods         = 3
alarm_period_seconds            = 300

# CDN Configuration
cloudfront_price_class          = "PriceClass_All"

# Storage Configuration
s3_lifecycle_glacier_transition_days = 90

# Tags
tags = {
  Environment     = "production"
  Project         = "cs-ai-platform"
  ManagedBy       = "terraform"
  DataClassification = "confidential"
  BusinessUnit    = "customer-success"
  CostCenter      = "cs-platform-prod"
  BackupSchedule  = "daily"
  SecurityZone    = "high"
}