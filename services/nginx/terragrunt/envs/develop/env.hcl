# env.hcl - Development environment configuration
locals {
  # Environment metadata
  environment = "develop"
  aws_region  = "ap-northeast-1"
  # Develop-specific resource tags
  additional_tags = {
    CostCenter   = "develop"
    Owner        = "panicboat"
    Purpose      = "demo-service"
    AutoShutdown = "enabled"
  }
}
