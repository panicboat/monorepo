# env.hcl - Development environment configuration
locals {
  # Environment metadata
  environment = "development"
  aws_region  = "us-east-1"

  # Development-specific Claude models (cost-effective selection)
  claude_models = [
    "anthropic.claude-3-haiku-20240307-v1:0", # Most cost-effective
    "anthropic.claude-3-sonnet-20240229-v1:0" # Balanced performance/cost
  ]

  # Additional IAM policies for development (if needed)
  additional_iam_policies = []

  # Development-specific resource tags
  additional_tags = {
    CostCenter   = "development"
    Owner        = "panicboat"
    AutoShutdown = "enabled"
    Purpose      = "development-testing"
  }
}
