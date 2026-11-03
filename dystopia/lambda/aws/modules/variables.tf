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

variable "database_host" {
  type        = string
  description = "Stable DNS alias for the RDS instance inside the VPC"
}

variable "database_port" {
  type        = number
  description = "PostgreSQL port"
}

variable "database_name" {
  type        = string
  description = "Name of the monolith database"
}

variable "database_username" {
  type        = string
  description = "Master user of the monolith database"
}

variable "database_password" {
  type        = string
  sensitive   = true
  description = "Master password of the monolith database"
}

variable "user_pool_id" {
  type        = string
  description = "Cognito user pool ID"
}

variable "user_pool_arn" {
  type        = string
  description = "Cognito user pool ARN"
}

variable "user_pool_client_id" {
  type        = string
  description = "Cognito app client ID used by the frontend"
}

variable "media_bucket_name" {
  type        = string
  description = "S3 bucket for media storage"
}

variable "media_bucket_arn" {
  type        = string
  description = "ARN of the S3 bucket for media storage"
}
