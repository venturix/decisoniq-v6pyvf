# Network Infrastructure Outputs
output "vpc_id" {
  description = "ID of the VPC hosting the Customer Success AI Platform"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for secure resource placement"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for internet-facing resources"
  value       = aws_subnet.public[*].id
}

# Compute Infrastructure Outputs
output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster running the application services"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_service_name" {
  description = "Name of the ECS service running the core application"
  value       = aws_ecs_service.app.name
}

output "ecs_task_definition_arn" {
  description = "ARN of the active ECS task definition"
  value       = aws_ecs_task_definition.app.arn
}

# Database Infrastructure Outputs
output "rds_endpoint" {
  description = "Connection endpoint for the PostgreSQL RDS instance"
  value       = module.rds.db_instance_endpoint
  sensitive   = true
}

output "rds_port" {
  description = "Port number for the RDS instance"
  value       = module.rds.db_instance_port
}

output "rds_database_name" {
  description = "Name of the application database"
  value       = "csai_platform"
}

# Caching Infrastructure Outputs
output "redis_endpoint" {
  description = "Connection endpoint for the Redis ElastiCache cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Port number for the Redis cluster"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_replication_group_id" {
  description = "ID of the Redis replication group"
  value       = aws_elasticache_replication_group.main.id
}

# ML Infrastructure Outputs
output "sagemaker_endpoint" {
  description = "Endpoint URL for the SageMaker ML model hosting"
  value       = aws_sagemaker_endpoint.main.endpoint_url
  sensitive   = true
}

output "sagemaker_execution_role_arn" {
  description = "ARN of the IAM role used by SageMaker for model execution"
  value       = aws_iam_role.sagemaker_execution.arn
}

# Content Delivery Outputs
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution for content delivery"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.domain_name
}

# Storage Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket for object storage"
  value       = aws_s3_bucket.main.id
}

output "s3_bucket_arn" {
  description = "ARN of the main S3 bucket"
  value       = aws_s3_bucket.main.arn
}

# Security Outputs
output "waf_web_acl_id" {
  description = "ID of the WAF web ACL protecting the application"
  value       = aws_wafv2_web_acl.main.id
}

output "kms_key_arn" {
  description = "ARN of the KMS key used for encryption"
  value       = aws_kms_key.main.arn
  sensitive   = true
}

# Monitoring Outputs
output "cloudwatch_log_group_name" {
  description = "Name of the main CloudWatch log group"
  value       = aws_cloudwatch_log_group.main.name
}

output "alarm_topic_arn" {
  description = "ARN of the SNS topic for infrastructure alarms"
  value       = aws_sns_topic.alarms.arn
}

# Load Balancer Outputs
output "alb_dns_name" {
  description = "DNS name of the application load balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Route 53 zone ID of the application load balancer"
  value       = aws_lb.main.zone_id
}