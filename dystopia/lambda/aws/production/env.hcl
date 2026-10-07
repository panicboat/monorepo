locals {
  aws_region = "ap-northeast-1"

  domain_name = "dystopia.city"

  route53_zone_role_arn = "arn:aws:iam::559744160976:role/route53-zone-access"

  additional_tags = {
    CostCenter = "production"
    Owner      = "panicboat"
    Purpose    = "dystopia"
  }
}
