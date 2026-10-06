locals {
  app_function_name  = "dystopia-${var.environment}"
  task_function_name = "dystopia-${var.environment}-task"

  # Avoid 9001 because the Lambda Runtime API listens on 127.0.0.1:9001.
  grpc_port = 50051

  database_url = "postgres://${aws_db_instance.monolith.username}:${random_password.monolith_db_master.result}@${aws_route53_record.monolith_db.name}:5432/${aws_db_instance.monolith.db_name}"

  # Stripe is unreachable without IPv4 egress, but the monolith refuses to boot unless these settings are present.
  shared_environment = {
    DATABASE_URL              = local.database_url
    COGNITO_REGION            = var.aws_region
    COGNITO_USER_POOL_ID      = aws_cognito_user_pool.this.id
    COGNITO_CLIENT_ID         = aws_cognito_user_pool_client.bff.id
    MEDIA_BUCKET_NAME         = aws_s3_bucket.media.bucket
    MEDIA_BUCKET_REGION       = var.aws_region
    STRIPE_API_KEY            = "disabled"
    STRIPE_WEBHOOK_SECRET     = "disabled"
    STRIPE_PRICE_ID_GUEST     = "disabled"
    STRIPE_PRICE_ID_CAST      = "disabled"
    BILLING_SUCCESS_URL       = "disabled"
    BILLING_CANCEL_URL        = "disabled"
    BILLING_PORTAL_RETURN_URL = "disabled"
  }
}

resource "aws_ecr_repository" "app" {
  name                 = "dystopia"
  image_tag_mutability = "MUTABLE"
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 10 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

resource "aws_iam_role" "lambda" {
  name = "dystopia-${var.environment}-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_app" {
  name = "dystopia-${var.environment}-lambda-app"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["cognito-idp:AdminDeleteUser"]
        Resource = aws_cognito_user_pool.this.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.media.arn}/*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/lambda/${local.app_function_name}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "task" {
  name              = "/aws/lambda/${local.task_function_name}"
  retention_in_days = 30
}

resource "aws_lambda_function" "app" {
  function_name = local.app_function_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:latest"
  architectures = ["arm64"]
  memory_size   = 1024
  timeout       = 30

  vpc_config {
    subnet_ids                  = [for subnet in aws_subnet.private : subnet.id]
    security_group_ids          = [aws_security_group.lambda.id]
    ipv6_allowed_for_dual_stack = true
  }

  environment {
    variables = merge(local.shared_environment, {
      GRPC_BIND_ADDRESS                = "0.0.0.0:${local.grpc_port}"
      MONOLITH_URL                     = "http://127.0.0.1:${local.grpc_port}"
      COGNITO_ADAPTER                  = "aws"
      OTEL_SDK_DISABLED                = "true"
      AWS_LWA_PORT                     = "3000"
      AWS_LWA_READINESS_CHECK_PORT     = tostring(local.grpc_port)
      AWS_LWA_READINESS_CHECK_PROTOCOL = "tcp"
    })
  }

  # The deploy workflow owns the running image so that migrations can run before the application is updated.
  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [
    aws_cloudwatch_log_group.app,
    aws_iam_role_policy_attachment.lambda_vpc_access,
  ]
}

resource "aws_lambda_function" "task" {
  function_name = local.task_function_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:latest"
  architectures = ["arm64"]
  memory_size   = 1024
  timeout       = 900

  image_config {
    entry_point       = ["node", "/app/lambda/task.mjs"]
    working_directory = "/app/monolith"
  }

  vpc_config {
    subnet_ids                  = [for subnet in aws_subnet.private : subnet.id]
    security_group_ids          = [aws_security_group.lambda.id]
    ipv6_allowed_for_dual_stack = true
  }

  environment {
    variables = merge(local.shared_environment, {
      AWS_LWA_PORT                 = "8080"
      AWS_LWA_READINESS_CHECK_PATH = "/"
      AWS_LWA_ERROR_STATUS_CODES   = "500-599"
    })
  }

  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [
    aws_cloudwatch_log_group.task,
    aws_iam_role_policy_attachment.lambda_vpc_access,
  ]
}

resource "aws_lambda_function_url" "app" {
  function_name      = aws_lambda_function.app.function_name
  authorization_type = "NONE"
  invoke_mode        = "BUFFERED"
}

resource "aws_lambda_permission" "app_function_url" {
  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.app.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Function URLs also require lambda:InvokeFunction, scoped here to invocations that arrive through the URL.
resource "aws_lambda_permission" "app_function_url_invoke" {
  statement_id             = "AllowPublicFunctionUrlInvoke"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.app.function_name
  principal                = "*"
  invoked_via_function_url = true
}
