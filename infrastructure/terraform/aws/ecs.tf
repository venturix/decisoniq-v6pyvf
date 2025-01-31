# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables
locals {
  cluster_name = "${var.project_prefix}-${var.environment}-cluster"
  container_insights = "enabled"
  common_tags = {
    Project     = var.project_prefix
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = local.cluster_name

  setting {
    name  = "containerInsights"
    value = local.container_insights
  }

  tags = local.common_tags
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight           = 1
    base            = 1
  }

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight           = 1
    base            = 0
  }
}

# Backend API Service
module "backend_service" {
  source = "../modules/ecs-service"

  service_name    = "${var.project_prefix}-${var.environment}-backend"
  cluster_id      = aws_ecs_cluster.main.id
  vpc_id          = var.vpc_id
  security_group_id = var.ecs_security_group_id
  environment     = var.environment
  
  # Container configuration
  container_port  = 8000
  cpu            = 1024
  memory         = 2048
  
  # Service configuration
  desired_count  = 2
  max_capacity   = 10
  min_capacity   = 2
  
  # Health check configuration
  health_check_path = "/api/health"
  health_check_grace_period_seconds = 60
  
  # Deployment configuration
  deployment_maximum_percent = 200
  deployment_minimum_healthy_percent = 100
  
  # Enable ECS Exec for debugging
  enable_execute_command = true
  
  tags = local.common_tags
}

# Frontend Web Service
module "web_service" {
  source = "../modules/ecs-service"

  service_name    = "${var.project_prefix}-${var.environment}-web"
  cluster_id      = aws_ecs_cluster.main.id
  vpc_id          = var.vpc_id
  security_group_id = var.ecs_security_group_id
  environment     = var.environment
  
  # Container configuration
  container_port  = 80
  cpu            = 512
  memory         = 1024
  
  # Service configuration
  desired_count  = 2
  max_capacity   = 8
  min_capacity   = 2
  
  # Health check configuration
  health_check_path = "/health"
  health_check_grace_period_seconds = 30
  
  # Deployment configuration
  deployment_maximum_percent = 200
  deployment_minimum_healthy_percent = 100
  
  tags = local.common_tags
}

# Outputs
output "cluster_id" {
  description = "ECS cluster identifier for service deployment"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "ECS cluster name for resource referencing"
  value       = aws_ecs_cluster.main.name
}

output "backend_service_id" {
  description = "Backend service identifier for monitoring"
  value       = module.backend_service.service_id
}

output "web_service_id" {
  description = "Web service identifier for monitoring"
  value       = module.web_service.service_id
}