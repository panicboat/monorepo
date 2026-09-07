variable "project_name" {
  type        = string
  description = "Project name (= services)"
}

variable "environment" {
  type        = string
  description = "Environment name (= develop / staging / production)"
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

variable "user_pool_name" {
  type        = string
  description = "Cognito User Pool name"
}

variable "db_identifier" {
  type        = string
  description = "RDS DB instance identifier (= 環境別に {env}/terragrunt.hcl で指定)"
}

variable "db_subnet_group_name" {
  type        = string
  description = "RDS DB subnet group name (= 環境別に {env}/terragrunt.hcl で指定)"
}
