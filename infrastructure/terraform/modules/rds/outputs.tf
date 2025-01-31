# Connection endpoint output with sensitive flag for security
output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS instance with automatic failover support"
  value       = aws_db_instance.this.endpoint
  sensitive   = true
}

# Database port output
output "db_instance_port" {
  description = "The port number the RDS instance is listening on"
  value       = aws_db_instance.this.port
  sensitive   = true
}

# Instance identifier output for resource referencing
output "db_instance_id" {
  description = "The RDS instance identifier for resource management"
  value       = aws_db_instance.this.id
}

# Instance ARN output for IAM and monitoring
output "db_instance_arn" {
  description = "The ARN of the RDS instance for IAM policy attachment and monitoring integration"
  value       = aws_db_instance.this.arn
}

# Database name output
output "db_instance_name" {
  description = "The name of the PostgreSQL database for application connection configuration"
  value       = aws_db_instance.this.db_name
  sensitive   = true
}