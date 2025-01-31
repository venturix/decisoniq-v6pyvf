# Core Project Variables
variable "project_prefix" {
  type        = string
  description = "Prefix to be used for all AWS resource names"
  default     = "cs-ai-platform"
}

variable "environment" {
  type        = string
  description = "Deployment environment (production/staging)"
  validation {
    condition     = can(regex("^(production|staging)$", var.environment))
    error_message = "Environment must be either 'production' or 'staging'."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for deploying resources"
  default     = "us-west-2"
}

# Networking Variables
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for multi-AZ deployment"
  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "At least 3 availability zones must be specified for high availability."
  }
}

# Compute Variables
variable "ecs_container_insights" {
  type        = bool
  description = "Enable Container Insights for ECS clusters"
  default     = true
}

variable "ecs_task_cpu" {
  type        = number
  description = "CPU units for ECS tasks"
  default     = 1024
  validation {
    condition     = var.ecs_task_cpu >= 256
    error_message = "ECS task CPU must be at least 256 units."
  }
}

variable "ecs_task_memory" {
  type        = number
  description = "Memory (MiB) for ECS tasks"
  default     = 2048
  validation {
    condition     = var.ecs_task_memory >= 512
    error_message = "ECS task memory must be at least 512 MiB."
  }
}

# Database Variables
variable "rds_instance_class" {
  type        = string
  description = "RDS instance class for PostgreSQL"
  validation {
    condition     = can(regex("^db\\.[a-z0-9]+\\.[a-z0-9]+$", var.rds_instance_class))
    error_message = "Invalid RDS instance class format."
  }
}

variable "rds_multi_az" {
  type        = bool
  description = "Enable Multi-AZ deployment for RDS"
  default     = true
}

# Caching Variables
variable "elasticache_node_type" {
  type        = string
  description = "ElastiCache node type for Redis"
  validation {
    condition     = can(regex("^cache\\.[a-z0-9]+\\.[a-z0-9]+$", var.elasticache_node_type))
    error_message = "Invalid ElastiCache node type format."
  }
}

variable "elasticache_num_cache_nodes" {
  type        = number
  description = "Number of cache nodes in the cluster"
  default     = 3
  validation {
    condition     = var.elasticache_num_cache_nodes >= 2
    error_message = "At least 2 cache nodes are required for high availability."
  }
}

# ML Infrastructure Variables
variable "sagemaker_instance_type" {
  type        = string
  description = "SageMaker instance type for model hosting"
  validation {
    condition     = can(regex("^ml\\.[a-z0-9]+\\.[a-z0-9]+$", var.sagemaker_instance_type))
    error_message = "Invalid SageMaker instance type format."
  }
}

variable "sagemaker_autoscaling_min_capacity" {
  type        = number
  description = "Minimum number of SageMaker instances"
  default     = 1
}

variable "sagemaker_autoscaling_max_capacity" {
  type        = number
  description = "Maximum number of SageMaker instances"
  default     = 4
}

# Security Variables
variable "kms_key_deletion_window" {
  type        = number
  description = "KMS key deletion window in days"
  default     = 30
  validation {
    condition     = var.kms_key_deletion_window >= 7 && var.kms_key_deletion_window <= 30
    error_message = "KMS key deletion window must be between 7 and 30 days."
  }
}

variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain backups"
  default     = 30
  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Backup retention period must be at least 7 days."
  }
}

variable "waf_rate_limit" {
  type        = number
  description = "WAF rate limit per 5 minutes per IP"
  default     = 2000
}

# Monitoring Variables
variable "alarm_evaluation_periods" {
  type        = number
  description = "Number of periods to evaluate CloudWatch alarms"
  default     = 3
}

variable "alarm_period_seconds" {
  type        = number
  description = "Period in seconds for CloudWatch alarm evaluation"
  default     = 300
}

# CDN Variables
variable "cloudfront_price_class" {
  type        = string
  description = "CloudFront distribution price class"
  default     = "PriceClass_All"
  validation {
    condition     = can(regex("^PriceClass_(All|100|200)$", var.cloudfront_price_class))
    error_message = "Invalid CloudFront price class. Must be PriceClass_All, PriceClass_100, or PriceClass_200."
  }
}

# Storage Variables
variable "s3_lifecycle_glacier_transition_days" {
  type        = number
  description = "Days after which objects transition to Glacier storage"
  default     = 90
  validation {
    condition     = var.s3_lifecycle_glacier_transition_days >= 30
    error_message = "Glacier transition must be at least 30 days."
  }
}