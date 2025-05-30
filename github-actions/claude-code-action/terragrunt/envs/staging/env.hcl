# env.hcl - Staging environment configuration
locals {
  # Environment metadata
  environment = "staging"
  aws_region  = "us-east-1"

  # Staging-specific Claude models (production-like but cost-conscious)
  claude_models = [
    "anthropic.claude-3-haiku-20240307-v1:0",
    "anthropic.claude-3-sonnet-20240229-v1:0",
    "anthropic.claude-3-5-sonnet-20240620-v1:0" # Latest Sonnet for testing
  ]

  # Additional IAM policies for staging (if needed)
  additional_iam_policies = []

  # Staging-specific resource tags
  additional_tags = {
    CostCenter  = "staging"
    Owner       = "panicboat"
    Environment = "pre-production"
    Purpose     = "integration-testing"
  }
}
