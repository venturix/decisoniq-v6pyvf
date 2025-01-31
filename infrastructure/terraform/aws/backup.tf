# AWS Backup configuration for Customer Success AI Platform
# Terraform AWS provider version ~> 5.0

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
  backup_retention_days = {
    production = 30
    staging    = 7
  }
  
  backup_schedule = {
    production = "cron(0 1 * * ? *)" # Daily at 1 AM UTC
    staging    = "cron(0 3 * * ? *)" # Daily at 3 AM UTC
  }
}

# KMS key for backup encryption
resource "aws_kms_key" "backup" {
  description             = "KMS key for AWS Backup encryption"
  deletion_window_in_days = 30
  enable_key_rotation    = true

  tags = {
    Environment = var.environment
    Project     = var.project_prefix
  }
}

# KMS key alias
resource "aws_kms_alias" "backup" {
  name          = "alias/${var.project_prefix}-${var.environment}-backup"
  target_key_id = aws_kms_key.backup.key_id
}

# Main backup vault
resource "aws_backup_vault" "main" {
  name        = "${var.project_prefix}-${var.environment}-vault"
  kms_key_arn = aws_kms_key.backup.arn
  
  tags = {
    Environment = var.environment
    Project     = var.project_prefix
  }
}

# Disaster recovery backup vault in secondary region
resource "aws_backup_vault" "dr" {
  provider    = aws.secondary
  name        = "${var.project_prefix}-${var.environment}-dr-vault"
  kms_key_arn = aws_kms_key.backup.arn
  
  tags = {
    Environment = var.environment
    Project     = var.project_prefix
  }
}

# IAM role for AWS Backup
resource "aws_iam_role" "backup" {
  name = "${var.project_prefix}-${var.environment}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })
}

# Attach AWS Backup service role policy
resource "aws_iam_role_policy_attachment" "backup" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
  role       = aws_iam_role.backup.name
}

# Main backup plan
resource "aws_backup_plan" "main" {
  name = "${var.project_prefix}-${var.environment}-plan"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = local.backup_schedule[var.environment]
    start_window      = 3600  # 1 hour
    completion_window = 7200  # 2 hours

    lifecycle {
      cold_storage_after = 30
      delete_after       = local.backup_retention_days[var.environment]
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.dr.arn
      
      lifecycle {
        delete_after = local.backup_retention_days[var.environment]
      }
    }
  }

  # Additional weekly backup rule for production
  dynamic "rule" {
    for_each = var.environment == "production" ? [1] : []
    content {
      rule_name         = "weekly_backup"
      target_vault_name = aws_backup_vault.main.name
      schedule          = "cron(0 2 ? * SUN *)" # Every Sunday at 2 AM UTC
      
      lifecycle {
        cold_storage_after = 90
        delete_after       = 365
      }

      copy_action {
        destination_vault_arn = aws_backup_vault.dr.arn
        
        lifecycle {
          delete_after = 365
        }
      }
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_prefix
  }
}

# Resource selection for backup
resource "aws_backup_selection" "resources" {
  name          = "${var.project_prefix}-${var.environment}-selection"
  iam_role_arn  = aws_iam_role.backup.arn
  plan_id       = aws_backup_plan.main.id

  resources = [
    module.rds.db_instance_arn
  ]

  # Add condition to select resources by tags
  selection_tag {
    type  = "STRINGEQUALS"
    key   = "Environment"
    value = var.environment
  }

  selection_tag {
    type  = "STRINGEQUALS"
    key   = "Backup"
    value = "true"
  }
}

# Outputs
output "backup_vault_arn" {
  description = "ARN of the main backup vault"
  value       = aws_backup_vault.main.arn
}

output "backup_plan_arn" {
  description = "ARN of the backup plan"
  value       = aws_backup_plan.main.arn
}