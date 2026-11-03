locals {
  environment = "develop"
  aws_region  = "ap-northeast-1"
  domain_name = "develop.dystopia.city"
  additional_tags = {
    CostCenter = "develop"
    Owner      = "panicboat"
    Purpose    = "monolith"
  }
}
