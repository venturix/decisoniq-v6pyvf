# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables for CloudFront configuration
variable "acm_certificate_arn" {
  type        = string
  description = "ARN of existing ACM certificate for CloudFront distribution"
  validation {
    condition     = can(regex("^arn:aws:acm:.*", var.acm_certificate_arn))
    error_message = "ACM certificate ARN must be valid AWS ACM ARN format."
  }
}

variable "logging_bucket" {
  type        = string
  description = "S3 bucket for CloudFront access logs"
  validation {
    condition     = length(var.logging_bucket) > 0
    error_message = "Logging bucket name must not be empty."
  }
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "${var.project_prefix}-${var.environment}-oai"
}

# Security Headers Policy
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "${var.project_prefix}-${var.environment}-security-headers"

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
      override = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled    = true
  http_version       = "http2and3"
  price_class        = "PriceClass_100"
  aliases            = ["${var.project_prefix}-${var.environment}.${var.domain_name}"]
  default_root_object = "index.html"
  
  origin {
    domain_name = aws_s3_bucket.application_assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.application_assets.id}"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
    
    origin_shield {
      enabled = true
      region  = "us-east-1"
    }
  }
  
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.application_assets.id}"
    
    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy     = "redirect-to-https"
    min_ttl                   = 0
    default_ttl               = 3600
    max_ttl                   = 86400
    compress                  = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }
  
  logging_config {
    bucket          = "${var.logging_bucket}.s3.amazonaws.com"
    prefix          = "cdn-logs/"
    include_cookies = true
  }
  
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  web_acl_id = aws_wafv2_web_acl.main.id
  
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }
  
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  
  tags = {
    Name          = "${var.project_prefix}-${var.environment}-cdn"
    Environment   = var.environment
    ManagedBy     = "terraform"
    SecurityLevel = "high"
  }
}

# Outputs
output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "The hosted zone ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
}

output "cloudfront_arn" {
  description = "The ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.arn
}