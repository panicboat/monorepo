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

dependency "monolith" {
  config_path = "../../../monolith/aws/production"

  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]

  mock_outputs = {
    database_host       = "monolith-db.dystopia.local"
    database_port       = 5432
    database_name       = "monolith"
    database_username   = "postgres"
    database_password   = "TestPassword0123456789"
    user_pool_id        = "ap-northeast-1_test"
    user_pool_arn       = "arn:aws:cognito-idp:ap-northeast-1:337169763788:userpool/ap-northeast-1_test"
    user_pool_client_id = "test-client"
    media_bucket_name   = "dystopia-media-337169763788"
    media_bucket_arn    = "arn:aws:s3:::dystopia-media-337169763788"
  }
}

inputs = {
  aws_region            = include.env.locals.aws_region
  domain_name           = include.env.locals.domain_name
  route53_zone_role_arn = include.env.locals.route53_zone_role_arn
  common_tags = merge(
    include.root.locals.common_tags,
    include.env.locals.additional_tags
  )

  database_host       = dependency.monolith.outputs.database_host
  database_port       = dependency.monolith.outputs.database_port
  database_name       = dependency.monolith.outputs.database_name
  database_username   = dependency.monolith.outputs.database_username
  database_password   = dependency.monolith.outputs.database_password
  user_pool_id        = dependency.monolith.outputs.user_pool_id
  user_pool_arn       = dependency.monolith.outputs.user_pool_arn
  user_pool_client_id = dependency.monolith.outputs.user_pool_client_id
  media_bucket_name   = dependency.monolith.outputs.media_bucket_name
  media_bucket_arn    = dependency.monolith.outputs.media_bucket_arn
}
