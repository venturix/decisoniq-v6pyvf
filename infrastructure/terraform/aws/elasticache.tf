# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# KMS key for Redis encryption
resource "aws_kms_key" "redis" {
  description             = "KMS key for Redis encryption"
  deletion_window_in_days = 30
  enable_key_rotation    = true

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-redis-kms"
    Environment = var.environment
    Service     = "cache"
    ManagedBy   = "terraform"
  }
}

resource "aws_kms_alias" "redis" {
  name          = "alias/${var.project_prefix}-${var.environment}-redis"
  target_key_id = aws_kms_key.redis.key_id
}

# SNS topic for Redis notifications
resource "aws_sns_topic" "redis_notifications" {
  name = "${var.project_prefix}-${var.environment}-redis-notifications"

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-redis-notifications"
    Environment = var.environment
    Service     = "cache"
    ManagedBy   = "terraform"
  }
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name_prefix = "${var.project_prefix}-${var.environment}-redis-"
  description = "Security group for Redis cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Redis from private subnets"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [for subnet in aws_subnet.private : subnet.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-redis-sg"
    Environment = var.environment
    Service     = "cache"
    ManagedBy   = "terraform"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Redis parameter group
resource "aws_elasticache_parameter_group" "redis" {
  family = "redis7"
  name   = "${var.project_prefix}-${var.environment}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "KEA"
  }

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-redis-params"
    Environment = var.environment
    Service     = "cache"
    ManagedBy   = "terraform"
  }
}

# Redis subnet group
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_prefix}-${var.environment}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-redis-subnet"
    Environment = var.environment
    Service     = "cache"
    ManagedBy   = "terraform"
  }
}

# Redis replication group
module "redis" {
  source = "../modules/redis"

  project_prefix              = var.project_prefix
  environment                = var.environment
  vpc_id                     = aws_vpc.main.id
  subnet_ids                 = aws_subnet.private[*].id
  node_type                  = "cache.r6g.large"
  engine_version             = "7.0"
  num_cache_clusters         = 3
  automatic_failover_enabled = true
  multi_az_enabled          = true
  transit_encryption_enabled = true
  at_rest_encryption_enabled = true
  auth_token_enabled        = true
  parameter_group_family    = "redis7"
  port                      = 6379
  maintenance_window        = "sun:05:00-sun:09:00"
  snapshot_window          = "00:00-04:00"
  snapshot_retention_limit = 7
  alarm_cpu_threshold_percent    = 75
  alarm_memory_threshold_percent = 75
  apply_immediately             = true
  auto_minor_version_upgrade   = true
  notification_topic_arn       = aws_sns_topic.redis_notifications.arn
  kms_key_id                  = aws_kms_key.redis.arn
  security_group_ids          = [aws_security_group.redis.id]

  tags = {
    Name        = "${var.project_prefix}-redis"
    Environment = var.environment
    Service     = "cache"
    ManagedBy   = "terraform"
  }
}

# CloudWatch alarms for Redis monitoring
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${var.project_prefix}-${var.environment}-redis-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ElastiCache"
  period             = 300
  statistic          = "Average"
  threshold          = 75
  alarm_description  = "Redis cluster CPU utilization"
  alarm_actions      = [aws_sns_topic.redis_notifications.arn]

  dimensions = {
    CacheClusterId = module.redis.redis_endpoint
  }

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-redis-cpu-alarm"
    Environment = var.environment
    Service     = "cache"
    ManagedBy   = "terraform"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "${var.project_prefix}-${var.environment}-redis-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name        = "DatabaseMemoryUsagePercentage"
  namespace          = "AWS/ElastiCache"
  period             = 300
  statistic          = "Average"
  threshold          = 75
  alarm_description  = "Redis cluster memory utilization"
  alarm_actions      = [aws_sns_topic.redis_notifications.arn]

  dimensions = {
    CacheClusterId = module.redis.redis_endpoint
  }

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-redis-memory-alarm"
    Environment = var.environment
    Service     = "cache"
    ManagedBy   = "terraform"
  }
}

# Outputs
output "redis_endpoint" {
  description = "Redis cluster endpoint address"
  value       = module.redis.redis_endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Redis cluster port number"
  value       = module.redis.redis_port
}