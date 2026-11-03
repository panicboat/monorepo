output "database_host" {
  value       = aws_route53_record.monolith_db.fqdn
  description = "Stable DNS alias for the RDS instance inside the VPC"
}

output "database_port" {
  value       = aws_db_instance.monolith.port
  description = "PostgreSQL port"
}

output "database_name" {
  value       = aws_db_instance.monolith.db_name
  description = "Name of the monolith database"
}

output "database_username" {
  value       = aws_db_instance.monolith.username
  description = "Master user of the monolith database"
}

output "database_password" {
  value       = random_password.monolith_db_master.result
  sensitive   = true
  description = "Master password of the monolith database"
}

output "user_pool_id" {
  value       = aws_cognito_user_pool.this.id
  description = "Cognito user pool ID"
}

output "user_pool_arn" {
  value       = aws_cognito_user_pool.this.arn
  description = "Cognito user pool ARN"
}

output "user_pool_client_id" {
  value       = aws_cognito_user_pool_client.this.id
  description = "Cognito app client ID used by the frontend"
}

output "media_bucket_name" {
  value       = aws_s3_bucket.media.bucket
  description = "S3 bucket for media storage"
}

output "media_bucket_arn" {
  value       = aws_s3_bucket.media.arn
  description = "ARN of the S3 bucket for media storage"
}
