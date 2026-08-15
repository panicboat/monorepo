locals {
  environment = "production"
  aws_region  = "ap-northeast-1"
  additional_tags = {
    CostCenter = "production"
    Owner      = "panicboat"
    Purpose    = "holmes-relay"
  }
}
