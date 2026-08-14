variable "environment" {
  type        = string
  description = "Environment name (= develop / staging / production)"
}

variable "common_tags" {
  type        = map(string)
  description = "Common resource tags"
  default     = {}
}
