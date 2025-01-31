# Provider configuration for AWS infrastructure deployment
# Version: ~> 5.0

terraform {
  # Specify minimum Terraform version required
  required_version = ">=1.5.0"

  # Define required providers
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Configure the AWS Provider with regional settings and default tags
provider "aws" {
  region = var.aws_region

  # Define default tags for all resources
  default_tags {
    tags = {
      Project     = "CustomerSuccessAIPlatform"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CreatedAt   = timestamp()
      Owner       = "Platform-Team"
      SecurityZone = "Production"
      Compliance  = "GDPR,SOC2"
    }
  }

  # Enable automatic region expansion for cross-region resources
  ignore_tags {
    key_prefixes = ["aws:"]
  }

  # Configure retry behavior for API calls
  retry_mode = "standard"
  max_retries = 3

  # Configure default endpoints for AWS services
  endpoints {
    dynamodb = "dynamodb.${var.aws_region}.amazonaws.com"
    s3       = "s3.${var.aws_region}.amazonaws.com"
    sts      = "sts.${var.aws_region}.amazonaws.com"
  }

  # Enable EC2 metadata tags
  metadata_tags {
    enabled = true
  }

  # Configure assume role for cross-account access if needed
  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformExecutionRole"
    session_name = "TerraformDeployment"
  }
}