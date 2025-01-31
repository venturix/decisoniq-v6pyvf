# Core instance configuration variables
variable "identifier_prefix" {
  type        = string
  description = "Prefix for the RDS instance identifier"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g., prod, staging, dev) for resource tagging"
}

variable "instance_class" {
  type        = string
  description = "The instance type of the RDS instance (e.g., db.t3.large)"
  validation {
    condition     = can(regex("^db\\.", var.instance_class))
    error_message = "The instance_class value must be a valid RDS instance type, starting with 'db.'"
  }
}

variable "allocated_storage" {
  type        = number
  description = "The allocated storage in gigabytes"
  validation {
    condition     = var.allocated_storage >= 20 && var.allocated_storage <= 65536
    error_message = "Allocated storage must be between 20 GB and 65536 GB"
  }
}

variable "max_allocated_storage" {
  type        = number
  description = "The upper limit in gigabytes to which RDS can automatically scale the storage"
  default     = 1000
}

# Database access configuration
variable "database_name" {
  type        = string
  description = "The name of the database to create when the DB instance is created"
}

variable "master_username" {
  type        = string
  description = "Username for the master DB user"
  sensitive   = true
}

variable "master_password" {
  type        = string
  description = "Password for the master DB user"
  sensitive   = true
  validation {
    condition     = length(var.master_password) >= 16
    error_message = "Master password must be at least 16 characters long"
  }
}

# High availability configuration
variable "multi_az" {
  type        = bool
  description = "Specifies if the RDS instance is multi-AZ"
  default     = true
}

# Network configuration
variable "subnet_ids" {
  type        = list(string)
  description = "A list of VPC subnet IDs to place the RDS instance in"
}

variable "vpc_security_group_ids" {
  type        = list(string)
  description = "List of VPC security group IDs to associate with the RDS instance"
}

# Backup and maintenance configuration
variable "backup_retention_period" {
  type        = number
  description = "The days to retain backups for"
  default     = 30
}

variable "backup_window" {
  type        = string
  description = "The daily time range during which automated backups are created (e.g., 03:00-04:00)"
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  type        = string
  description = "The window to perform maintenance in (e.g., Mon:04:00-Mon:05:00)"
  default     = "Mon:04:00-Mon:05:00"
}

# Performance and monitoring configuration
variable "performance_insights_enabled" {
  type        = bool
  description = "Specifies whether Performance Insights are enabled"
  default     = true
}

variable "monitoring_interval" {
  type        = number
  description = "The interval, in seconds, between points when Enhanced Monitoring metrics are collected"
  default     = 60
}

# Security configuration
variable "deletion_protection" {
  type        = bool
  description = "If the DB instance should have deletion protection enabled"
  default     = true
}

variable "storage_encrypted" {
  type        = bool
  description = "Specifies whether the DB instance is encrypted"
  default     = true
}

# Tagging configuration
variable "tags" {
  type        = map(string)
  description = "A map of tags to assign to the RDS instance"
  default     = {}
}