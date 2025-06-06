# outputs.tf - Output values

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions IAM role"
  value       = aws_iam_role.github_actions_role.arn
}

output "github_actions_role_name" {
  description = "Name of the GitHub Actions IAM role"
  value       = aws_iam_role.github_actions_role.name
}

output "oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider"
  value       = var.oidc_provider_arn
}

output "oidc_provider_url" {
  description = "URL of the GitHub OIDC provider"
  value       = "https://token.actions.githubusercontent.com"
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for GitHub Actions"
  value       = aws_cloudwatch_log_group.github_actions_logs.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group for GitHub Actions"
  value       = aws_cloudwatch_log_group.github_actions_logs.arn
}

output "claude_code_action_enabled" {
  description = "Whether Claude Code Action is enabled"
  value       = var.enable_claude_code_action
}

output "github_org" {
  description = "GitHub organization name"
  value       = var.github_org
}

output "github_repo" {
  description = "GitHub repository name"
  value       = var.github_repo
}

output "allowed_branches" {
  description = "List of GitHub branches that can assume the role"
  value       = var.github_branches
}

output "allowed_environments" {
  description = "List of GitHub environments that can assume the role"
  value       = var.github_environments
}

output "github_actions_workflow_info" {
  description = "Information needed for GitHub Actions workflow"
  value = var.enable_claude_code_action ? {
    aws_role_arn         = aws_iam_role.github_actions_role.arn
    aws_region           = var.bedrock_model_region
    github_org           = var.github_org
    github_repo          = var.github_repo
    allowed_branches     = var.github_branches
    allowed_environments = var.github_environments
  } : null
}
