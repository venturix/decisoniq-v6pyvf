# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for environment-specific configurations
locals {
  db_instance_class = {
    production = "db.r6g.2xlarge"
    staging    = "db.r6g.large"
  }
  
  db_allocated_storage = {
    production = 100
    staging    = 50
  }
}

# Data source to get VPC information
data "aws_vpc" "main" {
  id = data.aws_vpc.selected.id
}

# Data source to get private subnets
data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  tags = {
    Type = "private"
  }
}

# IAM role for RDS monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project_prefix}-${var.environment}-rds-monitoring"

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
    Name        = "${var.project_prefix}-${var.environment}-rds-monitoring"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Attach the monitoring policy to the IAM role
resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Security group for RDS instance
resource "aws_security_group" "rds" {
  name_prefix = "${var.project_prefix}-${var.environment}-rds-"
  description = "Security group for RDS PostgreSQL instance"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
    description     = "PostgreSQL access from application layer"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-rds-sg"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# RDS instance module
module "rds" {
  source = "../modules/rds"

  identifier_prefix = "${var.project_prefix}-${var.environment}"
  instance_class    = local.db_instance_class[var.environment]
  
  allocated_storage     = local.db_allocated_storage[var.environment]
  max_allocated_storage = local.db_allocated_storage[var.environment] * 2
  
  database_name = "csai_platform"
  engine       = "postgres"
  engine_version = "15.4"
  
  subnet_ids              = data.aws_subnets.private.ids
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  environment = var.environment
  multi_az    = true
  
  storage_encrypted = true
  storage_type     = "gp3"
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                  = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring.arn
  
  deletion_protection      = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.project_prefix}-${var.environment}-final"
  
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot     = true
  
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  parameter_group_family = "postgres15"
  parameters = [
    {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements,auto_explain"
    },
    {
      name  = "log_min_duration_statement"
      value = "1000"
    },
    {
      name  = "auto_explain.log_min_duration"
      value = "1000"
    }
  ]

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-rds"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Outputs
output "rds_endpoint" {
  description = "The RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "rds_port" {
  description = "The RDS instance port"
  value       = module.rds.db_instance_port
}

output "rds_database_name" {
  description = "The name of the RDS database"
  value       = "csai_platform"
}