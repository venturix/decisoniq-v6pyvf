# Production Environment Variables for Customer Success AI Platform
# Terraform version ~> 1.5.0

# Core Environment Configuration
variable "environment" {
  type        = string
  description = "Production environment identifier with strict validation"
  default     = "production"
  validation {
    condition     = var.environment == "production"
    error_message = "This configuration is strictly for production use only. Other environments must use their respective configurations."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for production deployment with high availability support"
  default     = "us-west-2"
  validation {
    condition     = contains(["us-west-2", "us-east-1", "eu-west-1"], var.aws_region)
    error_message = "Production deployments are only allowed in approved high-availability regions."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for production multi-AZ deployment"
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "Production environment requires at least 3 availability zones for high availability compliance."
  }
}

# Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "Production VPC CIDR block with appropriate size for scaling"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 32))
    error_message = "Production VPC CIDR must be a valid network address with sufficient IP space."
  }
}

# Database Configuration
variable "rds_instance_class" {
  type        = string
  description = "Production-grade RDS instance type with performance optimization"
  default     = "db.r6g.2xlarge"
  validation {
    condition     = can(regex("^db\\.(r6g|r5|x2g)\\.(2xlarge|4xlarge|8xlarge)$", var.rds_instance_class))
    error_message = "Production RDS instances must use approved high-performance instance types."
  }
}

variable "rds_allocated_storage" {
  type        = number
  description = "Allocated storage for production RDS instance with room for growth"
  default     = 100
  validation {
    condition     = var.rds_allocated_storage >= 100 && var.rds_allocated_storage <= 1000
    error_message = "Production RDS storage must be between 100GB and 1TB for optimal performance."
  }
}

# ECS Configuration
variable "ecs_desired_count" {
  type        = number
  description = "Desired number of ECS tasks for production services with high availability"
  default     = 3
  validation {
    condition     = var.ecs_desired_count >= 3
    error_message = "Production environment requires at least 3 ECS tasks for high availability."
  }
}

variable "ecs_min_capacity" {
  type        = number
  description = "Minimum number of ECS tasks for production auto-scaling"
  default     = 2
  validation {
    condition     = var.ecs_min_capacity >= 2
    error_message = "Production minimum capacity must be at least 2 for failover support."
  }
}

variable "ecs_max_capacity" {
  type        = number
  description = "Maximum number of ECS tasks for production auto-scaling"
  default     = 10
  validation {
    condition     = var.ecs_max_capacity >= var.ecs_min_capacity * 2
    error_message = "Production maximum capacity must be at least double the minimum capacity."
  }
}

# Backup and Recovery Configuration
variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups in production"
  default     = 30
  validation {
    condition     = var.backup_retention_period >= 30
    error_message = "Production backup retention must be at least 30 days for compliance."
  }
}

# Monitoring Configuration
variable "monitoring_interval" {
  type        = number
  description = "Enhanced monitoring interval in seconds for production environment"
  default     = 30
  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Production monitoring interval must be an approved CloudWatch value."
  }
}

variable "performance_insights_retention_period" {
  type        = number
  description = "Retention period for Performance Insights data in production"
  default     = 7
  validation {
    condition     = contains([7, 31, 62, 93, 186, 372, 731], var.performance_insights_retention_period)
    error_message = "Production Performance Insights retention must be an approved AWS value."
  }
}