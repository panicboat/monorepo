output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}

output "client_id" {
  value = aws_cognito_user_pool_client.bff.id
}

output "issuer" {
  value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}

output "jwks_uri" {
  value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.this.id}/.well-known/jwks.json"
}

output "rds_endpoint" {
  value       = aws_db_instance.monolith.address
  description = "RDS instance endpoint hostname"
}

output "rds_port" {
  value       = aws_db_instance.monolith.port
  description = "RDS instance port"
}

output "secret_arn" {
  value       = aws_secretsmanager_secret.monolith_database.arn
  description = "AWS Secrets Manager secret ARN for RDS credentials"
}

output "secret_name" {
  value       = aws_secretsmanager_secret.monolith_database.name
  description = "AWS Secrets Manager secret name (= ESO ExternalSecret で参照)"
}
