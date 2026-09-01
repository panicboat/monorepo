data "aws_caller_identity" "current" {}

resource "aws_iam_role" "cognito_sms" {
  name = "${var.user_pool_name}-cognito-sms"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cognito-idp.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "sts:ExternalId" = "${var.user_pool_name}-cognito-sms"
        }
      }
    }]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy" "cognito_sms" {
  name = "${var.user_pool_name}-cognito-sms"
  role = aws_iam_role.cognito_sms.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sns:Publish"]
      Resource = "*"
    }]
  })
}
