# env.hcl - Production environment configuration
locals {
  # Environment metadata
  environment = "production"
  aws_region  = "us-east-1"

  # Production-specific Claude models (all available for maximum capability)
  claude_models = [
    "anthropic.claude-3-haiku-20240307-v1:0",    # Fast, cost-effective
    "anthropic.claude-3-sonnet-20240229-v1:0",   # Balanced performance
    "anthropic.claude-3-5-sonnet-20240620-v1:0", # Latest and most capable
    "anthropic.claude-3-opus-20240229-v1:0"      # Most powerful model
  ]

  # Production might need additional policies for enhanced monitoring
  additional_iam_policies = [
    # Example: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
  ]

  # Production-specific resource tags
  additional_tags = {
    CostCenter     = "production"
    Owner          = "panicboat"
    Backup         = "required"
    MonitoringTier = "critical"
    Compliance     = "required"
    SLA            = "99.9%"
  }
}
