# env.hcl - Staging environment configuration
locals {
  # Environment metadata
  environment = "staging"
  aws_region  = "ap-northeast-1"
  # Staging-specific resource tags
  additional_tags = {
    CostCenter   = "staging"
    Owner        = "panicboat"
    Purpose      = "docs"
    AutoShutdown = "enabled"
  }
}
