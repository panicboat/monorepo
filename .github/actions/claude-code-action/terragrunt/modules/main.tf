# Get current AWS account information
data "aws_caller_identity" "current" {}

# GitHub OIDC provider is expected to already exist in the AWS account

# IAM Role for GitHub Actions OIDC
resource "aws_iam_role" "github_actions_role" {
  name                 = "${var.project_name}-${var.repository}-github-actions-role"
  max_session_duration = var.max_session_duration

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = var.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = concat(
              ["repo:${var.github_org}/${var.github_repo}:*"],
              [for branch in var.github_branches : "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/${branch}"],
              [for env in var.github_environments : "repo:${var.github_org}/${var.github_repo}:environment:${env}"]
            )
          }
        }
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name       = "${var.project_name}-${var.repository}-github-actions-role"
    GitHubOrg  = var.github_org
    GitHubRepo = var.github_repo
    Purpose    = "github-actions-oidc"
  })
}

# IAM Policy for Claude Code Action
resource "aws_iam_policy" "claude_bedrock_policy" {
  count = var.enable_claude_code_action ? 1 : 0

  name        = "${var.project_name}-${var.repository}-claude-bedrock-policy"
  description = "Policy for Claude Code Action to access Bedrock"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:GetFoundationModel",
          "bedrock:ListFoundationModels"
        ]
        Resource = [
          # Cross-region inference profile
          "arn:aws:bedrock:us-east-1:${data.aws_caller_identity.current.account_id}:inference-profile/${var.bedrock_model_id}",
          "arn:aws:bedrock:us-west-2:${data.aws_caller_identity.current.account_id}:inference-profile/${var.bedrock_model_id}",
          "arn:aws:bedrock:eu-west-1:${data.aws_caller_identity.current.account_id}:inference-profile/${var.bedrock_model_id}",
          # Foundation model
          "arn:aws:bedrock:*::foundation-model/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:ListInferenceProfiles",
          "bedrock:GetInferenceProfile"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name      = "${var.project_name}-${var.repository}-claude-bedrock-policy"
    Component = "claude-code-action"
  })
}

# Attach any additional policies specified
resource "aws_iam_role_policy_attachment" "claude_bedrock_policy" {
  count = var.enable_claude_code_action ? 1 : 0

  role       = aws_iam_role.github_actions_role.name
  policy_arn = aws_iam_policy.claude_bedrock_policy[0].arn
}

# CloudWatch Log Group for GitHub Actions
resource "aws_cloudwatch_log_group" "github_actions_logs" {
  name              = "/github-actions/${var.project_name}-${var.repository}"
  retention_in_days = 7

  tags = merge(var.common_tags, {
    LogGroup = "${var.project_name}-${var.repository}-github-actions"
  })
}
