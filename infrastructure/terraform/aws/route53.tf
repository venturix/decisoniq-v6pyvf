# AWS Provider configuration - version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary domain name variable
variable "domain_name" {
  type        = string
  description = "Primary domain name for the application"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid DNS name."
  }
}

# Primary Route53 hosted zone
resource "aws_route53_zone" "main" {
  name          = var.domain_name
  comment       = "${var.project_prefix}-${var.environment} DNS zone"
  force_destroy = false

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-zone"
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "dns-management"
  }
}

# A record for CloudFront distribution
resource "aws_route53_record" "main" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "${var.project_prefix}-${var.environment}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }
}

# Health check for the application endpoint
resource "aws_route53_health_check" "main" {
  fqdn              = "${var.project_prefix}-${var.environment}.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  measure_latency   = true

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-health-check"
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "endpoint-monitoring"
  }
}

# DNS failover record for high availability
resource "aws_route53_record" "failover_primary" {
  zone_id                          = aws_route53_zone.main.zone_id
  name                            = "api.${var.domain_name}"
  type                            = "A"
  set_identifier                  = "primary"
  health_check_id                 = aws_route53_health_check.main.id
  failover_routing_policy {
    type = "PRIMARY"
  }

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "failover_secondary" {
  zone_id                          = aws_route53_zone.main.zone_id
  name                            = "api.${var.domain_name}"
  type                            = "A"
  set_identifier                  = "secondary"
  failover_routing_policy {
    type = "SECONDARY"
  }

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }
}

# CNAME record for www subdomain
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = "300"
  records = ["${var.project_prefix}-${var.environment}.${var.domain_name}"]
}

# TXT record for domain verification
resource "aws_route53_record" "domain_verification" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = "300"
  records = ["v=spf1 include:_spf.${var.domain_name} -all"]
}

# Outputs
output "route53_zone_id" {
  description = "The ID of the Route53 hosted zone"
  value       = aws_route53_zone.main.zone_id
}

output "route53_name_servers" {
  description = "The name servers for the Route53 hosted zone"
  value       = aws_route53_zone.main.name_servers
}

output "domain_endpoints" {
  description = "The domain endpoints configured"
  value = {
    main     = "${var.project_prefix}-${var.environment}.${var.domain_name}"
    api      = "api.${var.domain_name}"
    www      = "www.${var.domain_name}"
  }
}