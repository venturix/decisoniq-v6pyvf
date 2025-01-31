# Core Terraform configuration requiring version 1.5 or higher
terraform {
  required_version = "~> 1.5"
}

# Service Configuration Variables
variable "service_name" {
  type        = string
  description = "Name of the ECS service"
  validation {
    condition     = can(regex("^[a-zA-Z0-9-_]+$", var.service_name)) && length(var.service_name) > 0 && length(var.service_name) <= 255
    error_message = "Service name must be between 1 and 255 characters and contain only alphanumeric characters, hyphens, and underscores"
  }
}

variable "cluster_id" {
  type        = string
  description = "ID of the ECS cluster where the service will be deployed"
  validation {
    condition     = can(regex("^arn:aws:ecs:[a-z0-9-]+:[0-9]{12}:cluster/.+$", var.cluster_id))
    error_message = "Cluster ID must be a valid ECS cluster ARN"
  }
}

variable "task_definition_arn" {
  type        = string
  description = "ARN of the task definition to be used by the service"
  validation {
    condition     = can(regex("^arn:aws:ecs:[a-z0-9-]+:[0-9]{12}:task-definition/.+$", var.task_definition_arn))
    error_message = "Task definition ARN must be valid"
  }
}

# Scaling Configuration Variables
variable "desired_count" {
  type        = number
  description = "Desired number of task instances to run"
  default     = 2
  validation {
    condition     = var.desired_count >= var.min_capacity && var.desired_count <= var.max_capacity
    error_message = "Desired count must be between min_capacity and max_capacity"
  }
}

variable "min_capacity" {
  type        = number
  description = "Minimum number of tasks for auto-scaling"
  default     = 1
  validation {
    condition     = var.min_capacity >= 1
    error_message = "Minimum capacity must be at least 1"
  }
}

variable "max_capacity" {
  type        = number
  description = "Maximum number of tasks for auto-scaling"
  default     = 10
  validation {
    condition     = var.max_capacity > var.min_capacity
    error_message = "Maximum capacity must be greater than minimum capacity"
  }
}

# Network Configuration Variables
variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs where the tasks will be placed"
  validation {
    condition     = length(var.private_subnet_ids) >= 3
    error_message = "At least 3 private subnets are required for high availability"
  }
}

variable "security_group_id" {
  type        = string
  description = "ID of the security group for the ECS tasks"
  validation {
    condition     = can(regex("^sg-[a-f0-9]+$", var.security_group_id))
    error_message = "Security group ID must be valid"
  }
}

# Load Balancer Configuration Variables
variable "target_group_arn" {
  type        = string
  description = "ARN of the ALB target group for service registration"
  validation {
    condition     = can(regex("^arn:aws:elasticloadbalancing:[a-z0-9-]+:[0-9]{12}:targetgroup/.+$", var.target_group_arn))
    error_message = "Target group ARN must be valid"
  }
}

# Container Configuration Variables
variable "container_name" {
  type        = string
  description = "Name of the container to route traffic to"
  validation {
    condition     = length(var.container_name) > 0
    error_message = "Container name cannot be empty"
  }
}

variable "container_port" {
  type        = number
  description = "Port number on the container to route traffic to"
  default     = 8080
  validation {
    condition     = var.container_port > 0 && var.container_port <= 65535
    error_message = "Container port must be between 1 and 65535"
  }
}

# Health Check Configuration Variables
variable "health_check_grace_period_seconds" {
  type        = number
  description = "Grace period for health checks to stabilize"
  default     = 120
  validation {
    condition     = var.health_check_grace_period_seconds >= 30
    error_message = "Health check grace period must be at least 30 seconds"
  }
}

# Service Management Variables
variable "enable_execute_command" {
  type        = bool
  description = "Enable ECS Exec for the service"
  default     = false
}

# Tagging Variables
variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all resources created by this module"
  validation {
    condition     = contains(keys(var.tags), "Environment") && contains(keys(var.tags), "Service")
    error_message = "Tags must include 'Environment' and 'Service' keys"
  }
}