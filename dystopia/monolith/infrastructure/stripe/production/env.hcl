# env.hcl - Production environment configuration for monolith Stripe stack
locals {
  environment = "production"
  aws_region  = "ap-northeast-1"
  additional_tags = {
    CostCenter   = "production"
    Owner        = "panicboat"
    Purpose      = "monolith-stripe"
    AutoShutdown = "enabled"
  }
}
