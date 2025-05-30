# terragrunt.hcl - Production environment Terragrunt configuration

# Include root configuration
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# Include environment-specific configuration
include "env" {
  path   = find_in_parent_folders("./envs/production/env.hcl")
  expose = true
}

# Reference to Terraform modules
terraform {
  source = "../../modules"
}

# Environment-specific inputs
inputs = {
  # Core configuration from env.hcl
  aws_region              = include.env.locals.aws_region
  claude_models           = include.env.locals.claude_models
  additional_iam_policies = include.env.locals.additional_iam_policies

  # Merge environment-specific tags with common tags
  common_tags = merge(
    {
      Environment = include.env.locals.environment
    },
    include.env.locals.additional_tags
  )
}
