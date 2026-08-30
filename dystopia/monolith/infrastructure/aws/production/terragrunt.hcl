include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path   = "env.hcl"
  expose = true
}

terraform {
  source = "../modules"
}

dependency "cognito" {
  config_path = "../../../../frontend/infrastructure/aws/production"

  mock_outputs = {
    user_pool_arn = "arn:aws:cognito-idp:ap-northeast-1:000000000000:userpool/mock"
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "terragrunt-state-${get_aws_account_id()}"
    key            = "dystopia/monolith/${include.env.locals.environment}/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "terragrunt-state-locks"
    encrypt        = true
  }
}

inputs = {
  aws_region = include.env.locals.aws_region
  common_tags = merge(
    {
      Environment = include.env.locals.environment
    },
    include.env.locals.additional_tags
  )
  db_identifier          = "monolith-production"
  db_subnet_group_name   = "monolith-production"
  db_security_group_name = "monolith-database-production"
  cognito_user_pool_arn  = dependency.cognito.outputs.user_pool_arn
}
