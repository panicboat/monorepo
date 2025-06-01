# terragrunt.hcl - Terragrunt configuration for panicboat/kubernetes-clusters repository

# Include root configuration
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# Include environment-specific configuration
include "env" {
  path   = "env.hcl"
  expose = true
}

# Terraform module source
terraform {
  source = "../../modules"

  extra_arguments "parallelism" {
    commands = ["plan", "apply", "destroy"]
    arguments = ["-parallelism=1"]
  }
}

# Repository-specific inputs
inputs = {
  repository_config = include.env.locals.repository_config
  github_token      = get_env("GITHUB_TOKEN", "")
}
