# Project and Environment Configuration
project_prefix = "cs-ai-platform-staging"
environment    = "staging"
aws_region     = "us-west-2"

# Network Configuration
vpc_cidr            = "10.1.0.0/16"
availability_zones  = ["us-west-2a"]

# Database Configuration
rds_instance_class      = "db.t3.large"
rds_allocated_storage   = 100
rds_multi_az           = false
enable_performance_insights = true
backup_retention_period = 7
monitoring_interval    = 60

# ECS Configuration
ecs_desired_count     = 1
ecs_min_capacity      = 1
ecs_max_capacity      = 4
ecs_task_cpu         = 1024
ecs_task_memory      = 2048
container_insights    = true

# Caching Configuration
elasticache_node_type        = "cache.t3.medium"
elasticache_num_cache_nodes  = 1

# ML Infrastructure
sagemaker_instance_type           = "ml.t3.medium"
sagemaker_autoscaling_min_capacity = 1
sagemaker_autoscaling_max_capacity = 2

# Security Configuration
kms_key_deletion_window = 30
waf_rate_limit         = 1000

# Monitoring Configuration
alarm_evaluation_periods = 3
alarm_period_seconds    = 300

# CDN Configuration
cloudfront_price_class = "PriceClass_100"

# Storage Configuration
s3_lifecycle_glacier_transition_days = 90

# Tags
common_tags = {
  Environment = "staging"
  Project     = "cs-ai-platform-staging"
  ManagedBy   = "terraform"
  CostCenter  = "staging-ops"
}