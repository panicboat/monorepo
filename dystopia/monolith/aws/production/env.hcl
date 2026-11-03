locals {
  environment = "production"
  aws_region  = "ap-northeast-1"
  domain_name = "dystopia.city"
  additional_tags = {
    CostCenter = "production"
    Owner      = "panicboat"
    Purpose    = "monolith"
  }
}
