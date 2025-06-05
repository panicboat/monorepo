locals {
  # Repository metadata
  repository_name = "monorepo"
  aws_region      = "ap-northeast-1"

  # GitHub configuration
  github_org  = "panicboat"
  github_repo = "monorepo"

  # GitHub branches that can assume the role for this repository
  github_branches = [
    "main",
    "develop",
    "feature/*",
    "hotfix/*"
  ]

  # GitHub environments that can assume the role
  github_environments = [
    "develop",
    "staging",
    "production"
  ]

  # OIDC provider settings
  create_oidc_provider = true
  oidc_provider_arn    = ""

  # Session duration (2 hours for monorepo)
  max_session_duration = 7200

  # Claude Code Action settings
  enable_claude_code_action = true
  bedrock_model_region     = "us-east-2"
  bedrock_model_id         = "us.anthropic.claude-sonnet-4-20250514-v1:0"

  # Repository-specific resource tags
  additional_tags = {
    Owner       = "panicboat"
    Purpose     = "claude-code-action-monorepo"
    Criticality = "high"
    AutoShutdown = "disabled"
  }
}
