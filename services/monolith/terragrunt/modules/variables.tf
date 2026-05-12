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

variable "db_identifier" {
  type        = string
  description = "RDS DB instance identifier (= 環境別に envs/{env}/terragrunt.hcl で指定)"
}

variable "db_subnet_group_name" {
  type        = string
  description = "RDS DB subnet group name (= 環境別に envs/{env}/terragrunt.hcl で指定)"
}

variable "db_security_group_name" {
  type        = string
  description = "RDS DB security group name (= 環境別に envs/{env}/terragrunt.hcl で指定)"
}
