# variables.tf - Input variables

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "repository" {
  description = "Repository name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "github_org" {
  description = "GitHub organization name"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
}

variable "github_branches" {
  description = "List of GitHub branches that can assume the role"
  type        = list(string)
  default     = ["main", "master"]
}

variable "github_environments" {
  description = "List of GitHub environments that can assume the role"
  type        = list(string)
  default     = []
}

variable "max_session_duration" {
  description = "Maximum session duration for the IAM role (in seconds)"
  type        = number
  default     = 3600
  validation {
    condition     = var.max_session_duration >= 900 && var.max_session_duration <= 43200
    error_message = "Max session duration must be between 900 and 43200 seconds (15 minutes to 12 hours)."
  }
}

variable "oidc_provider_arn" {
  description = "ARN of existing GitHub OIDC provider"
  type        = string
}

variable "enable_claude_code_action" {
  description = "Whether to enable Claude Code Action support"
  type        = bool
  default     = false
}

variable "bedrock_model_region" {
  description = "AWS region for Bedrock model access"
  type        = string
  default     = "us-east-2"
}

variable "bedrock_model_id" {
  description = "Bedrock model ID for Claude"
  type        = string
  default     = "anthropic.claude-sonnet-4-20250514-v1:0"
}
