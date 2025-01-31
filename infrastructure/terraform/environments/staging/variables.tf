# Core Environment Variables
variable "environment" {
  type        = string
  description = "Deployment environment identifier"
  default     = "staging"
}

variable "aws_region" {
  type        = string
  description = "AWS region for staging environment"
  default     = "us-west-2"
}

# Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for staging VPC"
  default     = "10.1.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for staging deployment"
  default     = ["us-west-2a"]
  validation {
    condition     = length(var.availability_zones) > 0
    error_message = "At least one availability zone must be specified for staging."
  }
}

# Database Configuration
variable "rds_instance_class" {
  type        = string
  description = "RDS instance type for staging environment"
  default     = "db.t3.large"
  validation {
    condition     = can(regex("^db\\.[a-z0-9]+\\.[a-z0-9]+$", var.rds_instance_class))
    error_message = "Invalid RDS instance class format."
  }
}

variable "rds_allocated_storage" {
  type        = number
  description = "Allocated storage for RDS instance in GB"
  default     = 100
  validation {
    condition     = var.rds_allocated_storage >= 20
    error_message = "RDS allocated storage must be at least 20 GB."
  }
}

# ECS Configuration
variable "ecs_desired_count" {
  type        = number
  description = "Desired number of ECS tasks for services"
  default     = 1
  validation {
    condition     = var.ecs_desired_count > 0
    error_message = "Desired ECS task count must be greater than 0."
  }
}

variable "ecs_min_capacity" {
  type        = number
  description = "Minimum number of ECS tasks for auto-scaling"
  default     = 1
  validation {
    condition     = var.ecs_min_capacity > 0
    error_message = "Minimum ECS capacity must be greater than 0."
  }
}

variable "ecs_max_capacity" {
  type        = number
  description = "Maximum number of ECS tasks for auto-scaling"
  default     = 4
  validation {
    condition     = var.ecs_max_capacity >= var.ecs_min_capacity
    error_message = "Maximum ECS capacity must be greater than or equal to minimum capacity."
  }
}

# Monitoring Configuration
variable "enable_performance_insights" {
  type        = bool
  description = "Enable RDS performance insights"
  default     = true
}

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain RDS backups"
  default     = 7
  validation {
    condition     = var.backup_retention_period >= 1
    error_message = "Backup retention period must be at least 1 day."
  }
}

variable "monitoring_interval" {
  type        = number
  description = "Enhanced monitoring interval in seconds"
  default     = 60
  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be one of: 0, 1, 5, 10, 15, 30, or 60 seconds."
  }
}

# Tags
locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_prefix
    ManagedBy   = "terraform"
  }
}