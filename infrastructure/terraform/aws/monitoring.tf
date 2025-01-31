# AWS CloudWatch monitoring configuration for Customer Success AI Platform
# Implements comprehensive observability with metrics, logging, and dashboards

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  log_retention_days = 90
  metric_namespace = "${var.project_prefix}-${var.environment}"
  dashboard_refresh_interval = 60
  metric_stream_interval = 60
  
  common_tags = {
    Environment = var.environment
    Project     = var.project_prefix
    ManagedBy   = "terraform"
  }
}

# CloudWatch Log Group for application and infrastructure logs
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aws/ecs/${var.project_prefix}-${var.environment}"
  retention_in_days = local.log_retention_days
  kms_key_id       = var.enable_encryption ? data.aws_kms_key.monitoring.arn : null
  tags             = local.common_tags
}

# CloudWatch Dashboard for system monitoring
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_prefix}-${var.environment}-main"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["${local.metric_namespace}/API", "Latency", "Service", "Prediction"],
            ["${local.metric_namespace}/API", "Success", "Service", "Prediction"]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Prediction Service Performance"
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", "${var.project_prefix}-${var.environment}"],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", "${var.project_prefix}-${var.environment}"]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "ECS Cluster Performance"
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["${local.metric_namespace}/Operations", "AutomatedInterventions"],
            ["${local.metric_namespace}/Operations", "ManualInterventions"]
          ]
          period = 3600
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "Intervention Efficiency Metrics"
        }
      }
    ]
  })
}

# CloudWatch Metric Stream for real-time monitoring
resource "aws_cloudwatch_metric_stream" "main" {
  name           = "${var.project_prefix}-${var.environment}-metrics"
  firehose_arn   = aws_kinesis_firehose_delivery_stream.metrics.arn
  output_format  = "json"
  role_arn       = aws_iam_role.metric_stream.arn

  include_filter {
    namespace = "AWS/ECS"
  }
  include_filter {
    namespace = "AWS/RDS"
  }
  include_filter {
    namespace = "AWS/ElastiCache"
  }
  include_filter {
    namespace = "AWS/SageMaker"
  }
  include_filter {
    namespace = "AWS/ApplicationELB"
  }
  include_filter {
    namespace = local.metric_namespace
  }
}

# IAM Role for CloudWatch Metric Stream
resource "aws_iam_role" "metric_stream" {
  name = "${var.project_prefix}-${var.environment}-metric-stream"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "streams.metrics.cloudwatch.amazonaws.com"
        }
      }
    ]
  })
}

# Custom CloudWatch Metrics for Operational Efficiency
resource "aws_cloudwatch_metric_alarm" "prediction_latency" {
  alarm_name          = "${var.project_prefix}-${var.environment}-prediction-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name        = "PredictionLatency"
  namespace          = local.metric_namespace
  period             = 300
  statistic          = "Average"
  threshold          = 3000  # 3 seconds in milliseconds
  alarm_description  = "Prediction latency exceeds 3 seconds"
  alarm_actions      = [data.aws_sns_topic.alerts.arn]
  
  dimensions = {
    Service = "Prediction"
  }
}

# Export values for other modules
output "cloudwatch_log_group_name" {
  value       = aws_cloudwatch_log_group.app_logs.name
  description = "Name of the CloudWatch Log Group for application logs"
}

output "metric_namespace" {
  value       = local.metric_namespace
  description = "Namespace for custom CloudWatch metrics"
}

output "dashboard_name" {
  value       = aws_cloudwatch_dashboard.main.dashboard_name
  description = "Name of the main CloudWatch dashboard"
}

# Data sources
data "aws_region" "current" {}

data "aws_kms_key" "monitoring" {
  key_id = "alias/${var.project_prefix}-${var.environment}-monitoring"
}

data "aws_sns_topic" "alerts" {
  name = "${var.project_prefix}-${var.environment}-alerts"
}