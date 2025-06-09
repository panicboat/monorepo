locals {
  # Repository metadata
  repository_name = "monorepo"
  aws_region      = "ap-northeast-1"

  # GitHub configuration
  github_org          = "panicboat"
  github_repo         = "monorepo"
  github_branches     = ["*"]
  github_environments = ["*"]

  # OIDC provider settings
  oidc_provider_arn = "arn:aws:iam::559744160976:oidc-provider/token.actions.githubusercontent.com"

  # Session duration (4 hours for monorepo)
  max_session_duration = 14400

  # Claude Code Action settings
  enable_claude_code_action = true
  bedrock_model_region      = "*"
  bedrock_model_id          = "*"

  # Repository-specific resource tags
  additional_tags = {
    Owner        = "panicboat"
    Purpose      = "claude-code-action-monorepo-relaxed"
    Criticality  = "high"
    AutoShutdown = "disabled"
    Permissions  = "relaxed"
  }
}
