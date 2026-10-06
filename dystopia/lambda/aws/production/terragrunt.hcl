include "root" {
  path   = find_in_parent_folders("root.hcl")
  expose = true
}

include "env" {
  path   = "env.hcl"
  expose = true
}

terraform {
  source = "../modules"
}

inputs = {
  aws_region            = include.env.locals.aws_region
  domain_name           = include.env.locals.domain_name
  route53_zone_role_arn = include.env.locals.route53_zone_role_arn
  common_tags = merge(
    include.root.locals.common_tags,
    include.env.locals.additional_tags
  )
}
