# terragrunt.hcl - Monorepo Terragrunt configuration

# Include root configuration
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# Include environment-specific configuration
include "env" {
  path   = "env.hcl"
  expose = true
}

# Reference to Terraform modules
terraform {
  source = "../../modules"
}

# Repository-specific inputs
inputs = {
  # Core configuration from repo.hcl
  aws_region              = include.repo.locals.aws_region
  github_org              = include.repo.locals.github_org
  github_repo             = include.repo.locals.github_repo
  github_branches         = include.repo.locals.github_branches
  github_environments     = include.repo.locals.github_environments
  create_oidc_provider    = include.repo.locals.create_oidc_provider
  oidc_provider_arn       = include.repo.locals.oidc_provider_arn
  max_session_duration    = include.repo.locals.max_session_duration

  # Claude Code Action configuration
  enable_claude_code_action = include.repo.locals.enable_claude_code_action
  bedrock_model_region     = include.repo.locals.bedrock_model_region
  bedrock_model_id         = include.repo.locals.bedrock_model_id

  # Merge repository-specific tags with common tags
  common_tags = merge(
    {
      Repository = include.repo.locals.repository_name
    },
    include.repo.locals.additional_tags
  )
}
