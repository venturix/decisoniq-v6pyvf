# AWS ElastiCache Redis module for Customer Success AI Platform
# Provides high-performance caching with multi-AZ deployment and encryption
# Version: hashicorp/aws ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Redis subnet group for multi-AZ deployment
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.project_prefix}-redis-subnet-group"
  description = "Subnet group for Redis cluster deployment"
  subnet_ids  = var.subnet_ids

  tags = {
    Name        = "${var.project_prefix}-redis-subnet-group"
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "customer-success-ai"
  }
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "${var.project_prefix}-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis port"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.selected.cidr_block]
  }

  tags = {
    Name        = "${var.project_prefix}-redis-sg"
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "customer-success-ai"
  }
}

# Redis parameter group with optimized settings
resource "aws_elasticache_parameter_group" "redis" {
  family      = "redis7.0"
  name        = "${var.project_prefix}-redis-params"
  description = "Redis parameter group for Customer Success AI Platform"

  # Performance optimization parameters
  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"  # Evict least recently used keys with expiration set
  }

  parameter {
    name  = "timeout"
    value = "300"  # 5-minute connection timeout
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"  # TCP keepalive for connection management
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"  # Sample size for LRU eviction
  }

  # Memory defragmentation settings
  parameter {
    name  = "activedefrag"
    value = "yes"
  }

  parameter {
    name  = "active-defrag-threshold-lower"
    value = "10"  # Start defrag when fragmentation is above 10%
  }

  parameter {
    name  = "active-defrag-threshold-upper"
    value = "100"  # Maximum defrag effort at 100% fragmentation
  }

  parameter {
    name  = "active-defrag-cycle-min"
    value = "25"  # Minimum CPU percentage to use for defrag
  }

  parameter {
    name  = "active-defrag-cycle-max"
    value = "75"  # Maximum CPU percentage to use for defrag
  }

  tags = {
    Name        = "${var.project_prefix}-redis-params"
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "customer-success-ai"
  }
}

# Redis replication group with multi-AZ support
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${var.project_prefix}-redis"
  replication_group_description = "Redis cluster for Customer Success AI Platform"
  
  # Engine configuration
  engine                     = "redis"
  engine_version             = var.engine_version
  node_type                  = var.node_type
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.redis.name
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]

  # High availability settings
  automatic_failover_enabled = true
  multi_az_enabled          = true
  num_cache_clusters        = 3  # Primary + 2 replicas for multi-AZ

  # Encryption configuration
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                 = var.auth_token
  kms_key_id                 = var.kms_key_id

  # Backup configuration
  snapshot_retention_limit = var.backup_retention_days
  snapshot_window         = "03:00-04:00"  # 3-4 AM UTC backup window
  maintenance_window      = "mon:04:00-mon:05:00"  # 4-5 AM UTC maintenance

  # Auto upgrade settings
  auto_minor_version_upgrade = true
  apply_immediately         = false  # Apply changes during maintenance window

  # Monitoring
  notification_topic_arn = var.sns_topic_arn

  tags = {
    Name              = "${var.project_prefix}-redis"
    Environment       = var.environment
    ManagedBy         = "terraform"
    Project           = "customer-success-ai"
    BackupRetention   = var.backup_retention_days
    EncryptionEnabled = "true"
    MultiAZ          = "true"
  }
}

# Data source for VPC CIDR
data "aws_vpc" "selected" {
  id = var.vpc_id
}

# Outputs
output "redis_endpoint" {
  description = "Redis cluster endpoint address"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis cluster port number"
  value       = aws_elasticache_replication_group.redis.port
}