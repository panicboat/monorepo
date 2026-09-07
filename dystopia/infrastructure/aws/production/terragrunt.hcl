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
  aws_region              = include.env.locals.aws_region
  user_pool_name          = "dystopia-production"
  db_identifier           = "monolith-production"
  db_subnet_group_name    = "monolith-production"
  common_tags = merge(
    include.root.locals.common_tags,
    include.env.locals.additional_tags
  )
}
