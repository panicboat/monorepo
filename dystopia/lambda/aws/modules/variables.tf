variable "environment" {
  type        = string
  description = "Environment name (production)"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "ap-northeast-1"
}

variable "common_tags" {
  type        = map(string)
  description = "Common resource tags"
  default     = {}
}

variable "domain_name" {
  type        = string
  description = "Public domain name served by CloudFront"
}

variable "route53_zone_role_arn" {
  type        = string
  description = "Role assumed to manage the public hosted zone in the management account"
}
