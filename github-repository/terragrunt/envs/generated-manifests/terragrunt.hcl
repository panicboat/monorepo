# terragrunt.hcl - Terragrunt configuration for panicboat/generated-manifests repository

# Include root configuration
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# Include environment-specific configuration
include "env" {
  path = "env.hcl"
}

# Terraform module source
terraform {
  source = "../../modules"
}

# Repository-specific inputs
inputs = {
  repository_config = local.repository_config
  github_token      = get_env("GITHUB_TOKEN", "")
}
