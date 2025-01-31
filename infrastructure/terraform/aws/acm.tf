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
  description = "Primary domain name for SSL certificate"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid DNS name."
  }
}

# ACM Certificate for the domain with wildcard support
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method        = "DNS"

  tags = {
    Name        = "${var.project_prefix}-${var.environment}-certificate"
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = "customer-success-ai"
  }

  lifecycle {
    create_before_destroy = true
  }

  options {
    certificate_transparency_logging_preference = "ENABLED"
  }
}

# DNS validation records for the ACM certificate
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => dvo
  }

  zone_id         = aws_route53_zone.main.zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 60
  allow_overwrite = true

  depends_on = [aws_route53_zone.main]
}

# Certificate validation
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "45m"
  }
}

# Outputs
output "acm_certificate_arn" {
  description = "ARN of the provisioned ACM certificate for use by CloudFront and ALB"
  value       = aws_acm_certificate.main.arn
}

output "acm_certificate_status" {
  description = "Current status of the ACM certificate for monitoring"
  value       = aws_acm_certificate.main.status
}