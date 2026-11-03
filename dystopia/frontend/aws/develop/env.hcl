locals {
  environment = "develop"
  aws_region  = "ap-northeast-1"
  additional_tags = {
    CostCenter = "develop"
    Owner      = "panicboat"
    Purpose    = "frontend"
  }
}
