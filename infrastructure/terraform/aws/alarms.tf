# AWS CloudWatch Alarms configuration for Customer Success AI Platform
# Implements comprehensive monitoring and alerting for system performance and health

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  alarm_evaluation_periods = 3
  alarm_period = 300
  metric_namespace = "${var.project_prefix}-${var.environment}"
  
  common_tags = {
    Environment = var.environment
    Project     = var.project_prefix
    ManagedBy   = "terraform"
  }
}

# KMS key for SNS topic encryption
resource "aws_kms_key" "sns" {
  description             = "KMS key for alarm notifications encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  tags                    = merge(local.common_tags, {
    Name = "${var.project_prefix}-${var.environment}-sns-key"
  })
}

# SNS topic for alarm notifications
resource "aws_sns_topic" "alarms" {
  name              = "${var.project_prefix}-${var.environment}-alarms"
  kms_master_key_id = aws_kms_key.sns.arn
  tags              = merge(local.common_tags, {
    Name = "${var.project_prefix}-${var.environment}-alarms"
  })
}

# API Latency Alarm
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${var.project_prefix}-${var.environment}-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = local.alarm_evaluation_periods
  metric_name         = "Duration"
  namespace           = local.metric_namespace
  period             = local.alarm_period
  statistic          = "Average"
  threshold          = var.alarm_thresholds["api_latency_ms"]
  alarm_description  = "API latency exceeds 3 seconds"
  alarm_actions      = [aws_sns_topic.alarms.arn]
  ok_actions         = [aws_sns_topic.alarms.arn]
  insufficient_data_actions = [aws_sns_topic.alarms.arn]
  treat_missing_data = "breaching"
  
  tags = merge(local.common_tags, {
    Name = "${var.project_prefix}-${var.environment}-api-latency"
    Type = "Performance"
  })
}

# Error Rate Alarm
resource "aws_cloudwatch_metric_alarm" "error_rate" {
  alarm_name          = "${var.project_prefix}-${var.environment}-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = local.alarm_evaluation_periods
  metric_name         = "5XXError"
  namespace           = local.metric_namespace
  period             = local.alarm_period
  statistic          = "Average"
  threshold          = var.alarm_thresholds["error_rate_percent"]
  alarm_description  = "Error rate exceeds 1%"
  alarm_actions      = [aws_sns_topic.alarms.arn]
  ok_actions         = [aws_sns_topic.alarms.arn]
  insufficient_data_actions = [aws_sns_topic.alarms.arn]
  treat_missing_data = "breaching"
  
  tags = merge(local.common_tags, {
    Name = "${var.project_prefix}-${var.environment}-error-rate"
    Type = "Error"
  })
}

# ML Prediction Latency Alarm
resource "aws_cloudwatch_metric_alarm" "ml_prediction_latency" {
  alarm_name          = "${var.project_prefix}-${var.environment}-ml-prediction-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = local.alarm_evaluation_periods
  metric_name         = "ModelLatency"
  namespace           = "AWS/SageMaker"
  period             = local.alarm_period
  statistic          = "Average"
  threshold          = var.alarm_thresholds["ml_latency_ms"]
  alarm_description  = "ML prediction latency exceeds 1 second"
  alarm_actions      = [aws_sns_topic.alarms.arn]
  ok_actions         = [aws_sns_topic.alarms.arn]
  insufficient_data_actions = [aws_sns_topic.alarms.arn]
  treat_missing_data = "breaching"
  
  tags = merge(local.common_tags, {
    Name = "${var.project_prefix}-${var.environment}-ml-prediction-latency"
    Type = "ML"
  })
}

# Variables for alarm thresholds
variable "alarm_thresholds" {
  type = map(number)
  description = "Configurable thresholds for different alarm metrics"
  default = {
    api_latency_ms    = 3000  # 3 seconds
    error_rate_percent = 1     # 1%
    ml_latency_ms     = 1000  # 1 second
  }
}

# Outputs
output "alarm_topic_arn" {
  value       = aws_sns_topic.alarms.arn
  description = "SNS topic ARN for alarm notifications integration"
}

output "kms_key_arn" {
  value       = aws_kms_key.sns.arn
  description = "KMS key ARN for SNS topic encryption"
}