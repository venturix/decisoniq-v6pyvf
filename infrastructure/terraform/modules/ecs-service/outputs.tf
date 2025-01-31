# Output definitions for the ECS service module
# These outputs expose essential service information for monitoring and management

output "service_id" {
  description = "The unique identifier of the ECS service for monitoring and management"
  value       = aws_ecs_service.service.id
}

output "service_name" {
  description = "The name of the ECS service for resource identification and tagging"
  value       = aws_ecs_service.service.name
}

output "service_cluster" {
  description = "The ARN of the ECS cluster where the service is deployed"
  value       = aws_ecs_service.service.cluster
}

output "autoscaling_target_id" {
  description = "The identifier of the auto scaling target for scaling policy management"
  value       = aws_appautoscaling_target.service.resource_id
}

output "autoscaling_namespace" {
  description = "The service namespace for auto-scaling configuration and monitoring"
  value       = aws_appautoscaling_target.service.service_namespace
}