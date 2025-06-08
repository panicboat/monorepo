# terragrunt.hcl - Monorepo Terragrunt configuration
# TEST: Auto Label Architecture testing - claude-code-action service

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
  aws_region              = include.env.locals.aws_region
  github_org              = include.env.locals.github_org
  github_repo             = include.env.locals.github_repo
  github_branches         = include.env.locals.github_branches
  github_environments     = include.env.locals.github_environments
  oidc_provider_arn       = include.env.locals.oidc_provider_arn
  max_session_duration    = include.env.locals.max_session_duration

  # Claude Code Action configuration
  enable_claude_code_action = include.env.locals.enable_claude_code_action
  bedrock_model_region     = include.env.locals.bedrock_model_region
  bedrock_model_id         = include.env.locals.bedrock_model_id

  # Merge repository-specific tags with common tags
  common_tags = merge(
    {
      Repository = include.env.locals.repository_name
    },
    include.env.locals.additional_tags
  )
}
