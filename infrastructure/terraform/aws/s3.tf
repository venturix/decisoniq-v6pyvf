# AWS S3 bucket configurations for the Customer Success AI Platform
# Provider version ~> 5.0

# ML Models Bucket
resource "aws_s3_bucket" "ml_models" {
  bucket        = "${var.project_prefix}-${var.environment}-ml-models"
  force_destroy = false

  tags = {
    Name        = "ML Models Storage"
    Environment = var.environment
    Purpose     = "ML model artifacts storage"
    ManagedBy   = "terraform"
  }
}

# Customer Data Backup Bucket
resource "aws_s3_bucket" "customer_data" {
  bucket        = "${var.project_prefix}-${var.environment}-customer-data"
  force_destroy = false

  tags = {
    Name        = "Customer Data Backups"
    Environment = var.environment
    Purpose     = "Customer data backup storage"
    ManagedBy   = "terraform"
  }
}

# Application Assets Bucket
resource "aws_s3_bucket" "application_assets" {
  bucket        = "${var.project_prefix}-${var.environment}-assets"
  force_destroy = false

  tags = {
    Name        = "Application Assets"
    Environment = var.environment
    Purpose     = "Static asset storage"
    ManagedBy   = "terraform"
  }
}

# System Logs Bucket
resource "aws_s3_bucket" "system_logs" {
  bucket        = "${var.project_prefix}-${var.environment}-logs"
  force_destroy = false

  tags = {
    Name        = "System Logs"
    Environment = var.environment
    Purpose     = "System logging storage"
    ManagedBy   = "terraform"
  }
}

# Versioning Configuration
resource "aws_s3_bucket_versioning" "ml_models" {
  bucket = aws_s3_bucket.ml_models.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "customer_data" {
  bucket = aws_s3_bucket.customer_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "application_assets" {
  bucket = aws_s3_bucket.application_assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "system_logs" {
  bucket = aws_s3_bucket.system_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Encryption Configuration
resource "aws_s3_bucket_server_side_encryption_configuration" "ml_models" {
  bucket = aws_s3_bucket.ml_models.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.main.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "customer_data" {
  bucket = aws_s3_bucket.customer_data.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.main.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "application_assets" {
  bucket = aws_s3_bucket.application_assets.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.main.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "system_logs" {
  bucket = aws_s3_bucket.system_logs.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.main.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

# Lifecycle Rules
resource "aws_s3_bucket_lifecycle_configuration" "ml_models" {
  bucket = aws_s3_bucket.ml_models.id

  rule {
    id     = "ml_models_lifecycle"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "system_logs" {
  bucket = aws_s3_bucket.system_logs.id

  rule {
    id     = "system_logs_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 2555  # 7 years retention
    }
  }
}

# Public Access Block (for all buckets)
resource "aws_s3_bucket_public_access_block" "ml_models" {
  bucket = aws_s3_bucket.ml_models.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "customer_data" {
  bucket = aws_s3_bucket.customer_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "application_assets" {
  bucket = aws_s3_bucket.application_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "system_logs" {
  bucket = aws_s3_bucket.system_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Output bucket names
output "ml_models_bucket_name" {
  description = "Name of the ML models S3 bucket"
  value       = aws_s3_bucket.ml_models.id
}

output "customer_data_bucket_name" {
  description = "Name of the customer data S3 bucket"
  value       = aws_s3_bucket.customer_data.id
}

output "application_assets_bucket_name" {
  description = "Name of the application assets S3 bucket"
  value       = aws_s3_bucket.application_assets.id
}

output "system_logs_bucket_name" {
  description = "Name of the system logs S3 bucket"
  value       = aws_s3_bucket.system_logs.id
}