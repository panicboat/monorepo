mock_provider "aws" {
  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::337169763788:role/test"
    }
  }

  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:337169763788:certificate/00000000-0000-0000-0000-000000000000"
    }
  }

  mock_resource "aws_lambda_function" {
    defaults = {
      arn = "arn:aws:lambda:ap-northeast-1:337169763788:function:dystopia-task"
    }
  }

  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "337169763788"
    }
  }

  mock_resource "aws_lambda_function_url" {
    defaults = {
      function_url = "https://abcdefghijklmnop.lambda-url.ap-northeast-1.on.aws/"
    }
  }
}

mock_provider "aws" {
  alias = "us_east_1"

  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:337169763788:certificate/00000000-0000-0000-0000-000000000000"
    }
  }
}

mock_provider "aws" {
  alias = "route53"
}

override_data {
  target = data.aws_vpc.this
  values = {
    id = "vpc-test"
  }
}

override_data {
  target = data.aws_subnets.private
  values = {
    ids = ["subnet-a", "subnet-c", "subnet-d"]
  }
}

override_data {
  target = data.aws_security_group.internal
  values = {
    id = "sg-internal"
  }
}

mock_provider "tls" {}

override_resource {
  target = tls_private_key.vapid
  values = {
    private_key_pem = "test-vapid-pem"
  }
}

variables {
  aws_region            = "ap-northeast-1"
  domain_name           = "dystopia.city"
  route53_zone_role_arn = "arn:aws:iam::559744160976:role/route53-zone-access"
  common_tags = {
    Environment = "production"
  }
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

run "functions_join_the_shared_vpc" {
  command = plan

  assert {
    condition = alltrue([
      for fn in [aws_lambda_function.app, aws_lambda_function.task] :
      fn.vpc_config[0].subnet_ids == toset(["subnet-a", "subnet-c", "subnet-d"]) &&
      fn.vpc_config[0].security_group_ids == toset(["sg-internal"])
    ])
    error_message = "Both functions must run in the private subnets of the shared VPC with the internal security group."
  }

  assert {
    condition = (
      aws_lambda_function.app.vpc_config[0].ipv6_allowed_for_dual_stack == true &&
      aws_lambda_function.task.vpc_config[0].ipv6_allowed_for_dual_stack == true
    )
    error_message = "Both functions must allow IPv6 egress on dual-stack subnets."
  }
}

run "grpc_port_avoids_the_lambda_runtime_api" {
  command = plan

  assert {
    condition     = aws_lambda_function.app.environment[0].variables["GRPC_BIND_ADDRESS"] == "0.0.0.0:50051"
    error_message = "The monolith must bind gRPC to port 50051."
  }

  assert {
    condition     = aws_lambda_function.app.environment[0].variables["MONOLITH_URL"] == "http://127.0.0.1:50051"
    error_message = "The frontend must call the monolith on the same gRPC port."
  }

  assert {
    condition = (
      aws_lambda_function.app.environment[0].variables["AWS_LWA_READINESS_CHECK_PORT"] == "50051" &&
      aws_lambda_function.app.environment[0].variables["AWS_LWA_READINESS_CHECK_PROTOCOL"] == "tcp"
    )
    error_message = "Readiness must wait for the gRPC port over TCP."
  }

  assert {
    condition     = aws_lambda_function.app.environment[0].variables["AWS_LWA_PORT"] == "3000"
    error_message = "The adapter must forward requests to Next.js on port 3000."
  }
}

run "application_function_settings" {
  command = plan

  assert {
    condition = (
      aws_lambda_function.app.function_name == "dystopia" &&
      aws_lambda_function.app.memory_size == 1024 &&
      aws_lambda_function.app.timeout == 30 &&
      aws_lambda_function.app.architectures == tolist(["arm64"])
    )
    error_message = "The application function must be dystopia on arm64 with 1024 MB and a 30 second timeout."
  }

  assert {
    condition     = aws_lambda_function.app.environment[0].variables["COGNITO_ADAPTER"] == "aws"
    error_message = "The frontend must use the real Cognito adapter."
  }

  assert {
    condition     = aws_lambda_function.app.environment[0].variables["DATABASE_URL"] == "postgres://postgres:TestPassword0123456789@monolith-db.dystopia.local:5432/monolith"
    error_message = "DATABASE_URL must point at the private DNS alias."
  }

  assert {
    condition = (
      aws_lambda_function.app.environment[0].variables["COGNITO_USER_POOL_ID"] == "ap-northeast-1_test" &&
      aws_lambda_function.app.environment[0].variables["COGNITO_CLIENT_ID"] == "test-client" &&
      aws_lambda_function.app.environment[0].variables["MEDIA_BUCKET_NAME"] == "dystopia-media-337169763788"
    )
    error_message = "The user pool, its client and the media bucket must come from the data layer."
  }

  assert {
    condition     = aws_lambda_function_url.app.authorization_type == "NONE"
    error_message = "The function URL must be public so CloudFront can forward browser POST requests."
  }

  assert {
    condition     = aws_lambda_function_url.app.function_name == "dystopia"
    error_message = "The only function URL must belong to the application function, never to the task function."
  }
}

run "task_function_settings" {
  command = plan

  assert {
    condition = (
      aws_lambda_function.task.function_name == "dystopia-task" &&
      aws_lambda_function.task.timeout == 900
    )
    error_message = "The task function must be dystopia-task with a 900 second timeout."
  }

  assert {
    condition = (
      aws_lambda_function.task.image_config[0].entry_point == tolist(["node", "/app/lambda/task.mjs"]) &&
      aws_lambda_function.task.image_config[0].working_directory == "/app/monolith"
    )
    error_message = "The task function must start task.mjs from the monolith directory."
  }

  assert {
    condition = (
      aws_lambda_function.task.environment[0].variables["AWS_LWA_PORT"] == "8080" &&
      aws_lambda_function.task.environment[0].variables["AWS_LWA_ERROR_STATUS_CODES"] == "500-599"
    )
    error_message = "The task function must surface HTTP 5xx responses as failed invocations."
  }

  assert {
    condition     = aws_lambda_function.task.environment[0].variables["DATABASE_URL"] == aws_lambda_function.app.environment[0].variables["DATABASE_URL"]
    error_message = "Both functions must use the same database."
  }
}

run "cloudfront_serves_the_domain" {
  command = plan

  assert {
    condition     = aws_cloudfront_distribution.this.aliases == toset(["dystopia.city"])
    error_message = "CloudFront must serve the public domain."
  }

  assert {
    condition     = one(aws_cloudfront_distribution.this.origin).domain_name == "abcdefghijklmnop.lambda-url.ap-northeast-1.on.aws"
    error_message = "The origin must be the function URL host without scheme or trailing slash."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.ordered_cache_behavior[0].path_pattern == "/_next/static/*"
    error_message = "Static assets must have their own cached behavior."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "Viewers must be redirected to HTTPS."
  }

  assert {
    condition     = toset(keys(aws_route53_record.apex)) == toset(["A", "AAAA"])
    error_message = "The apex must have both A and AAAA alias records."
  }
}

run "push_settings" {
  command = plan

  assert {
    condition     = tls_private_key.vapid.algorithm == "ECDSA" && tls_private_key.vapid.ecdsa_curve == "P256"
    error_message = "Web push requires an ECDSA P-256 VAPID key."
  }

  assert {
    condition = alltrue([
      for fn in [aws_lambda_function.app, aws_lambda_function.task] :
      fn.environment[0].variables["VAPID_PRIVATE_KEY"] == "test-vapid-pem" &&
      fn.environment[0].variables["VAPID_SUBJECT"] == "https://dystopia.city"
    ])
    error_message = "Both functions must receive the VAPID key and subject."
  }
}

run "account_purge_runs_daily" {
  command = plan

  assert {
    condition = (
      aws_scheduler_schedule.purge_deactivated.schedule_expression == "cron(0 4 * * ? *)" &&
      aws_scheduler_schedule.purge_deactivated.schedule_expression_timezone == "Asia/Tokyo"
    )
    error_message = "The account purge must run every day at 04:00 Asia/Tokyo."
  }

  assert {
    condition     = aws_scheduler_schedule.purge_deactivated.flexible_time_window[0].mode == "OFF"
    error_message = "The account purge must start at the scheduled time, not within a flexible window."
  }

  assert {
    condition     = aws_scheduler_schedule.purge_deactivated.target[0].input == jsonencode({ task = "purge_deactivated" })
    error_message = "The schedule must send the purge_deactivated task to the task function."
  }

  assert {
    condition     = aws_scheduler_schedule.purge_deactivated.target[0].retry_policy[0].maximum_retry_attempts == 0
    error_message = "The scheduler must not retry a failed purge."
  }

  assert {
    condition     = aws_lambda_function_event_invoke_config.task.maximum_retry_attempts == 0
    error_message = "Lambda must not re-run a failed asynchronous purge invocation."
  }

  assert {
    condition     = jsondecode(aws_iam_role.scheduler.assume_role_policy).Statement[0].Condition.StringEquals["aws:SourceAccount"] == "337169763788"
    error_message = "Only schedules of this account may assume the scheduler role."
  }
}

run "purge_lists_only_media_keys" {
  command = plan

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_role_policy.lambda_app.policy).Statement :
      try(statement.Action == ["s3:ListBucket"] && statement.Resource == var.media_bucket_arn && statement.Condition.StringLike["s3:prefix"] == ["media/*"], false)
    ])
    error_message = "The purge must list the objects under a profile's key prefix, and the listing must stay under media/."
  }
}

run "names_have_no_environment" {
  command = plan

  assert {
    condition = (
      aws_iam_role.lambda.name == "dystopia-lambda" &&
      aws_iam_role.scheduler.name == "dystopia-scheduler" &&
      aws_iam_role_policy.lambda_app.name == "dystopia-lambda-app" &&
      aws_iam_role_policy.scheduler_invoke_task.name == "dystopia-scheduler-invoke-task"
    )
    error_message = "The IAM roles and policies must not carry an environment name."
  }

  assert {
    condition     = aws_scheduler_schedule.purge_deactivated.name == "dystopia-purge-deactivated"
    error_message = "The schedule must not carry an environment name."
  }

  assert {
    condition = (
      aws_cloudwatch_log_group.app.name == "/aws/lambda/dystopia" &&
      aws_cloudwatch_log_group.task.name == "/aws/lambda/dystopia-task"
    )
    error_message = "The log groups must match the function names."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.comment == "dystopia"
    error_message = "The CloudFront comment must not carry an environment name."
  }
}
