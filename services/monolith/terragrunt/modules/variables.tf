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
