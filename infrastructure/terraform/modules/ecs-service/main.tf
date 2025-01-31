# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ECS Service Definition
resource "aws_ecs_service" "service" {
  name                              = var.service_name
  cluster                          = var.cluster_id
  task_definition                  = var.task_definition_arn
  desired_count                    = var.desired_count
  launch_type                      = "FARGATE"
  platform_version                 = "LATEST"
  enable_execute_command           = var.enable_execute_command
  health_check_grace_period_seconds = var.health_check_grace_period_seconds

  # Network configuration for Fargate tasks
  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  # Load balancer integration
  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.container_name
    container_port   = var.container_port
  }

  # Deployment configuration with circuit breaker and rollback
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  # Service discovery and tagging configuration
  propagate_tags            = "SERVICE"
  enable_ecs_managed_tags   = true
  
  # Resource tagging
  tags = merge(var.tags, {
    ManagedBy = "terraform"
  })

  # Ensure replacement of tasks on changes
  lifecycle {
    create_before_destroy = true
  }
}

# Auto Scaling Target Definition
resource "aws_appautoscaling_target" "service" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${split("/", var.cluster_id)[1]}/${aws_ecs_service.service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  tags = merge(var.tags, {
    ManagedBy = "terraform"
  })
}

# CPU-based Auto Scaling Policy
resource "aws_appautoscaling_policy" "cpu_scaling" {
  name               = "${var.service_name}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.service.resource_id
  scalable_dimension = aws_appautoscaling_target.service.scalable_dimension
  service_namespace  = aws_appautoscaling_target.service.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# Memory-based Auto Scaling Policy
resource "aws_appautoscaling_policy" "memory_scaling" {
  name               = "${var.service_name}-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.service.resource_id
  scalable_dimension = aws_appautoscaling_target.service.scalable_dimension
  service_namespace  = aws_appautoscaling_target.service.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

# Output definitions
output "service_id" {
  description = "The ID of the ECS service"
  value       = aws_ecs_service.service.id
}

output "service_name" {
  description = "The name of the ECS service"
  value       = aws_ecs_service.service.name
}

output "autoscaling_target_id" {
  description = "The ID of the auto scaling target"
  value       = aws_appautoscaling_target.service.id
}