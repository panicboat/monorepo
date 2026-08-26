variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "environment" {
  type = string
}

variable "common_tags" {
  type    = map(string)
  default = {}
}

variable "user_pool_name" {
  type = string
}
