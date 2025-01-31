# Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  name_prefix = "${var.project_prefix}-${var.environment}"
  common_tags = {
    Environment         = var.environment
    ManagedBy          = "terraform"
    SecurityCompliance = "soc2-iso27001"
  }
}

# ECS Task Execution Role
resource "aws_iam_role" "ecs_task_execution_role" {
  name                 = "${local.name_prefix}-ecs-execution-role"
  description          = "Enhanced IAM role for ECS task execution with security controls"
  permissions_boundary = "arn:aws:iam::aws:policy/boundary/ECSTaskBoundary"
  force_detach_policies = true
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount": data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-execution-role"
  })
}

# ECS Task Role
resource "aws_iam_role" "ecs_task_role" {
  name                 = "${local.name_prefix}-ecs-task-role"
  description          = "Enhanced IAM role for ECS tasks with security boundaries"
  permissions_boundary = "arn:aws:iam::aws:policy/boundary/ECSServiceBoundary"
  force_detach_policies = true

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount": data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-task-role"
  })
}

# SageMaker Execution Role
resource "aws_iam_role" "sagemaker_execution_role" {
  name                 = "${local.name_prefix}-sagemaker-execution-role"
  description          = "Enhanced IAM role for SageMaker with encryption requirements"
  permissions_boundary = "arn:aws:iam::aws:policy/boundary/MLServiceBoundary"
  force_detach_policies = true

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount": data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-sagemaker-execution-role"
  })
}

# ECS Task Custom Policy
resource "aws_iam_role_policy" "ecs_task_permissions" {
  name = "${local.name_prefix}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${local.name_prefix}-*",
          "arn:aws:s3:::${local.name_prefix}-*/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption": "aws:kms"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint"
        ]
        Resource = [
          "arn:aws:sagemaker:*:*:endpoint/${local.name_prefix}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:*:*:log-group:/aws/ecs/${local.name_prefix}-*"
        ]
      }
    ]
  })
}

# SageMaker Custom Policy
resource "aws_iam_role_policy" "sagemaker_permissions" {
  name = "${local.name_prefix}-sagemaker-policy"
  role = aws_iam_role.sagemaker_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${local.name_prefix}-ml-*",
          "arn:aws:s3:::${local.name_prefix}-ml-*/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption": "aws:kms"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:ResourceTag/Environment": var.environment
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach AWS managed policies
resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy_attachment" "sagemaker_execution" {
  role       = aws_iam_role.sagemaker_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Outputs
output "ecs_task_execution_role_arn" {
  description = "ARN of enhanced ECS task execution role"
  value       = aws_iam_role.ecs_task_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "ARN of enhanced ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

output "sagemaker_execution_role_arn" {
  description = "ARN of enhanced SageMaker execution role"
  value       = aws_iam_role.sagemaker_execution_role.arn
}