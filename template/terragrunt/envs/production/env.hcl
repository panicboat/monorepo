# env.hcl - Production environment configuration
locals {
  # Environment metadata
  environment = "production"
  aws_region  = "ap-northeast-1"
  # Production-specific resource tags
  additional_tags = {
    CostCenter   = "production"
    Owner        = "panicboat"
    Purpose      = "template"
    AutoShutdown = "disabled"
  }
}
