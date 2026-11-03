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
  aws_region = include.env.locals.aws_region
  common_tags = merge(
    include.root.locals.common_tags,
    include.env.locals.additional_tags
  )
}
