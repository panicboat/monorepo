variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "common_tags" {
  type        = map(string)
  description = "Common resource tags"
  default     = {}
}
