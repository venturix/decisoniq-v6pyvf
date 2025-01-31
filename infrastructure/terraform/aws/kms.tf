# AWS Provider configuration - version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary KMS key for data encryption
resource "aws_kms_key" "main" {
  description             = "KMS key for encrypting data at rest"
  deletion_window_in_days = 30
  enable_key_rotation    = true
  is_enabled            = true

  # Key policy allowing AWS services to use the key for encryption/decryption
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowRDSEncryption"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowS3Encryption"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowElastiCacheEncryption"
        Effect = "Allow"
        Principal = {
          Service = "elasticache.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowBackupEncryption"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:CreateGrant",
          "kms:ListGrants",
          "kms:RevokeGrant"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name          = "${var.project_prefix}-${var.environment}-kms-key"
    Environment   = var.environment
    Purpose       = "data-encryption"
    ManagedBy     = "terraform"
    SecurityLevel = "high"
    Service       = "customer-success-ai"
    Compliance    = "gdpr-compliant"
  }
}

# KMS key alias for easier reference
resource "aws_kms_alias" "main" {
  name          = "alias/${var.project_prefix}-${var.environment}-key"
  target_key_id = aws_kms_key.main.key_id
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# Output the KMS key ID
output "kms_key_id" {
  description = "The ID of the KMS key"
  value       = aws_kms_key.main.key_id
}

# Output the KMS key ARN
output "kms_key_arn" {
  description = "The ARN of the KMS key"
  value       = aws_kms_key.main.arn
}

# Output the KMS alias name
output "kms_alias_name" {
  description = "The name of the KMS key alias"
  value       = aws_kms_alias.main.name
}