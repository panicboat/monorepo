resource "aws_cognito_user_pool" "this" {
  name = var.user_pool_name

  alias_attributes = ["phone_number"]

  auto_verified_attributes = ["phone_number"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  schema {
    name                = "phone_number"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  mfa_configuration = "OFF"

  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }

  sms_configuration {
    external_id    = "${var.user_pool_name}-cognito-sms"
    sns_caller_arn = aws_iam_role.cognito_sms.arn
    sns_region     = var.aws_region
  }

  # Guard against terraform destroy wiping the pool by accident.
  deletion_protection = "ACTIVE"

  tags = var.common_tags
}

resource "aws_cognito_user_pool_client" "bff" {
  name         = "${var.user_pool_name}-bff"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}
