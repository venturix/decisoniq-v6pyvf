# Output definitions for Redis ElastiCache module
# Exposes connection details and security configuration for the Customer Success AI Platform
# Version: hashicorp/terraform ~> 1.5

output "redis_endpoint" {
  description = "Redis cluster primary endpoint address for secure application connectivity"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true  # Marked sensitive to prevent exposure in logs
}

output "redis_port" {
  description = "Redis cluster port number for application connection configuration"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_security_group_id" {
  description = "ID of the security group attached to the Redis cluster for network access control"
  value       = aws_elasticache_replication_group.redis.security_group_ids[0]
}