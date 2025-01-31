# Backend configuration for Terraform state management
# Version: hashicorp/terraform >= 1.5.0

terraform {
  backend "s3" {
    # S3 bucket for storing Terraform state
    bucket = "${var.terraform_state_bucket}"
    
    # State file path within bucket using environment
    key = "${var.environment}/terraform.tfstate"
    
    # AWS region for state storage
    region = "${var.aws_region}"
    
    # Enable state file encryption at rest
    encrypt = true
    
    # DynamoDB table for state locking
    dynamodb_table = "terraform-state-lock"
    
    # Workspace prefix for multi-environment state organization
    workspace_key_prefix = "customer-success-ai"
    
    # Additional security configurations
    versioning = true
    sse_algorithm = "aws:kms"
    
    # Access logging for audit trail
    access_logging = {
      target_bucket = "${var.terraform_state_bucket}-logs"
      target_prefix = "state-access-logs/"
    }
  }
}