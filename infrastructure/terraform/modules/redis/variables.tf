# Terraform variables definition file for Redis ElastiCache module
# Configures high-performance caching infrastructure with multi-AZ support and encryption
# Required by the Customer Success AI Platform for sub-3s predictions and high availability

variable "project_prefix" {
  description = "Prefix to be used for all Redis-related resource names"
  type        = string

  validation {
    condition     = length(var.project_prefix) > 0
    error_message = "Project prefix cannot be empty"
  }
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be one of: production, staging, development"
  }
}

variable "aws_region" {
  description = "AWS region where Redis cluster will be deployed"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where Redis cluster will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for Redis cluster deployment (minimum 3 for multi-AZ)"
  type        = list(string)

  validation {
    condition     = length(var.subnet_ids) >= 3
    error_message = "At least 3 subnet IDs are required for multi-AZ deployment"
  }
}

variable "node_type" {
  description = "Redis node instance type"
  type        = string
  default     = "cache.r6g.large"  # r6g instance type optimized for memory-intensive workloads
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"  # Latest stable Redis version with enhanced security and performance
}

variable "backup_retention_days" {
  description = "Number of days to retain Redis backups"
  type        = number
  default     = 7  # One week retention for disaster recovery
}