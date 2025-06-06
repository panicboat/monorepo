# root.hcl - Root Terragrunt configuration for Claude Code Action

locals {
  # Project metadata
  project_name = "claude-code-action"

  # Parse repository from the directory path
  path_parts = split("/", path_relative_to_include())
  repository = element(local.path_parts, length(local.path_parts) - 1)

  # Common tags applied to all resources
  common_tags = {
    Project    = local.project_name
    Repository = local.repository
    ManagedBy  = "terragrunt"
    Component  = "claude-code-action"
    Team       = "panicboat"
  }
}

# Remote state configuration using shared S3 bucket
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    # Shared bucket for all repositories
    bucket = "terragrunt-state-${get_aws_account_id()}"

    # Repository-specific path: claude-code-action/<repository>/terraform.tfstate
    key    = "claude-code-action/${local.repository}/terraform.tfstate"
    region = "ap-northeast-1"

    # Shared DynamoDB table for state locking across all services
    dynamodb_table = "terragrunt-state-locks"

    # Enable server-side encryption
    encrypt = true
  }
}

# Common inputs passed to all Terraform modules
inputs = {
  project_name = local.project_name
  repository   = local.repository
  common_tags  = local.common_tags
  aws_region   = "ap-northeast-1"
}
