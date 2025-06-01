# variables.tf - Input variables for GitHub Repository Management module

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Repository name (e.g., monorepo, generated-manifests)"
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

variable "github_token" {
  description = "GitHub personal access token"
  type        = string
  sensitive   = true
}

variable "repository_config" {
  description = "Repository configuration object"
  type = object({
    name        = string
    description = string
    visibility  = string
    features = object({
      issues   = bool
      wiki     = bool
      projects = bool
    })
    branch_protection = map(object({
      pattern                         = optional(string)
      required_reviews                = number
      dismiss_stale_reviews           = bool
      require_code_owner_reviews      = bool
      required_status_checks          = list(string)
      enforce_admins                  = bool
      allow_force_pushes              = bool
      allow_deletions                 = bool
      required_linear_history         = bool
      require_conversation_resolution = bool
      require_signed_commits          = bool
    }))
  })
}
