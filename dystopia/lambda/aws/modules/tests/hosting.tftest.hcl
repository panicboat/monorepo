mock_provider "aws" {
  mock_resource "aws_vpc" {
    defaults = {
      id              = "vpc-test"
      ipv6_cidr_block = "2406:da14:1234:5600::/56"
    }
  }

  mock_resource "aws_security_group" {
    defaults = {
      id = "sg-test"
    }
  }

  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::337169763788:role/test"
    }
  }

  mock_resource "aws_cognito_user_pool" {
    defaults = {
      arn = "arn:aws:cognito-idp:ap-northeast-1:337169763788:userpool/ap-northeast-1_test"
    }
  }

  mock_resource "aws_s3_bucket" {
    defaults = {
      arn = "arn:aws:s3:::dystopia-media-production"
    }
  }

  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:337169763788:certificate/00000000-0000-0000-0000-000000000000"
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

mock_provider "random" {}

override_resource {
  target = random_password.monolith_db_master
  values = {
    result = "TestPassword0123456789"
  }
}

variables {
  environment           = "production"
  aws_region            = "ap-northeast-1"
  domain_name           = "dystopia.city"
  route53_zone_role_arn = "arn:aws:iam::559744160976:role/route53-zone-access"
  common_tags = {
    Environment = "production"
  }
}

run "database_is_private" {
  command = plan

  assert {
    condition     = aws_db_instance.monolith.publicly_accessible == false
    error_message = "RDS must not be publicly accessible."
  }

  assert {
    condition = (
      aws_vpc_security_group_ingress_rule.rds_from_lambda.from_port == 5432 &&
      aws_vpc_security_group_ingress_rule.rds_from_lambda.to_port == 5432 &&
      aws_vpc_security_group_ingress_rule.rds_from_lambda.cidr_ipv4 == null &&
      aws_vpc_security_group_ingress_rule.rds_from_lambda.cidr_ipv6 == null
    )
    error_message = "RDS must accept PostgreSQL traffic from a security group only, never from a CIDR range."
  }

  assert {
    condition     = aws_db_instance.monolith.deletion_protection == true
    error_message = "RDS must be protected from deletion because every push to main applies this stack unattended."
  }

  assert {
    condition     = random_password.monolith_db_master.special == false
    error_message = "The database password must stay alphanumeric because DATABASE_URL embeds it without escaping."
  }

  assert {
    condition     = length(aws_subnet.private) == 3
    error_message = "The VPC must have one private subnet in each of the three availability zones."
  }
}

run "egress_is_ipv6_only" {
  command = plan

  assert {
    condition     = aws_route.ipv6_egress.destination_ipv6_cidr_block == "::/0"
    error_message = "The only default route must be the IPv6 route through the egress-only internet gateway."
  }

  assert {
    condition     = aws_vpc_endpoint.s3.vpc_endpoint_type == "Gateway"
    error_message = "S3 must be reached through a gateway endpoint."
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
      aws_lambda_function.app.function_name == "dystopia-production" &&
      aws_lambda_function.app.memory_size == 1024 &&
      aws_lambda_function.app.timeout == 30 &&
      aws_lambda_function.app.architectures == tolist(["arm64"])
    )
    error_message = "The application function must be dystopia-production on arm64 with 1024 MB and a 30 second timeout."
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
    condition     = aws_lambda_function_url.app.authorization_type == "NONE"
    error_message = "The function URL must be public so CloudFront can forward browser POST requests."
  }

  assert {
    condition     = aws_lambda_function_url.app.function_name == "dystopia-production"
    error_message = "The only function URL must belong to the application function, never to the task function."
  }
}

run "task_function_settings" {
  command = plan

  assert {
    condition = (
      aws_lambda_function.task.function_name == "dystopia-production-task" &&
      aws_lambda_function.task.timeout == 900
    )
    error_message = "The task function must be dystopia-production-task with a 900 second timeout."
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
