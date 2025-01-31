# Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

# Local variables
locals {
  engine_version      = "15.3"
  port               = 5432
  backup_window      = "03:00-04:00"
  maintenance_window = "Mon:04:00-Mon:05:00"
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# IAM role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name_prefix = "${var.identifier_prefix}-monitoring-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.identifier_prefix}-monitoring-role"
    Environment = var.environment
    Terraform   = "true"
  }
}

# Attach Enhanced Monitoring policy to IAM role
resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Security group for RDS instance
resource "aws_security_group" "this" {
  name_prefix = "${var.identifier_prefix}-postgresql-"
  description = "Security group for ${var.identifier_prefix} PostgreSQL RDS instance"
  vpc_id      = data.aws_subnet.first.vpc_id

  tags = {
    Name        = "${var.identifier_prefix}-postgresql-sg"
    Environment = var.environment
    Terraform   = "true"
  }
}

# Security group rule for PostgreSQL access
resource "aws_security_group_rule" "postgresql" {
  type              = "ingress"
  from_port         = local.port
  to_port           = local.port
  protocol          = "tcp"
  cidr_blocks       = [data.aws_vpc.selected.cidr_block]
  security_group_id = aws_security_group.this.id
}

# DB subnet group
resource "aws_db_subnet_group" "this" {
  name_prefix = "${var.identifier_prefix}-"
  subnet_ids  = var.subnet_ids

  tags = {
    Name        = "${var.identifier_prefix}-subnet-group"
    Environment = var.environment
    Terraform   = "true"
  }
}

# DB parameter group
resource "aws_db_parameter_group" "this" {
  name_prefix = "${var.identifier_prefix}-"
  family      = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_checkpoints"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  tags = {
    Name        = "${var.identifier_prefix}-pg"
    Environment = var.environment
    Terraform   = "true"
  }
}

# RDS instance
resource "aws_db_instance" "this" {
  identifier = "${var.identifier_prefix}-postgresql"

  # Engine configuration
  engine         = "postgres"
  engine_version = local.engine_version
  instance_class = var.instance_class

  # Storage configuration
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type         = "gp3"
  storage_encrypted    = true

  # Database configuration
  db_name  = var.database_name
  username = var.master_username
  password = var.master_password
  port     = local.port

  # High availability configuration
  multi_az = true

  # Backup configuration
  backup_retention_period = 7
  backup_window          = local.backup_window
  maintenance_window     = local.maintenance_window
  copy_tags_to_snapshot  = true

  # Deletion protection
  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.identifier_prefix}-final-snapshot-${random_id.suffix.hex}"
  delete_automated_backups  = true

  # Performance and monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                  = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring.arn

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]
  parameter_group_name   = aws_db_parameter_group.this.name

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  tags = {
    Name        = "${var.identifier_prefix}-postgresql"
    Environment = var.environment
    Terraform   = "true"
  }
}

# Data source for VPC information
data "aws_subnet" "first" {
  id = var.subnet_ids[0]
}

data "aws_vpc" "selected" {
  id = data.aws_subnet.first.vpc_id
}

# Outputs
output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.this.endpoint
}

output "db_instance_port" {
  description = "The port number the RDS instance is listening on"
  value       = aws_db_instance.this.port
}

output "db_instance_id" {
  description = "The RDS instance identifier"
  value       = aws_db_instance.this.id
}