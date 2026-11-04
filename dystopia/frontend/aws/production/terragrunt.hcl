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
}
