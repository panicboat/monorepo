variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "common_tags" {
  type        = map(string)
  description = "Common resource tags"
  default     = {}
}

variable "domain_name" {
  type        = string
  description = "Public domain name allowed to upload media from the browser"
}
