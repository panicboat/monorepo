output "ecr_repository_url" {
  value       = aws_ecr_repository.app.repository_url
  description = "ECR repository that holds the combined frontend and monolith image"
}

output "app_function_name" {
  value       = aws_lambda_function.app.function_name
  description = "Lambda function that serves the application"
}

output "task_function_name" {
  value       = aws_lambda_function.task.function_name
  description = "Lambda function that runs migrations and ad hoc SQL"
}

output "function_url" {
  value       = aws_lambda_function_url.app.function_url
  description = "Origin URL behind CloudFront"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.this.domain_name
  description = "CloudFront distribution domain name"
}

output "user_pool_id" {
  value       = aws_cognito_user_pool.this.id
  description = "Cognito user pool ID"
}

output "client_id" {
  value       = aws_cognito_user_pool_client.bff.id
  description = "Cognito app client ID used by the frontend"
}

output "media_bucket_name" {
  value       = aws_s3_bucket.media.bucket
  description = "S3 bucket for media storage"
}

output "rds_alias" {
  value       = aws_route53_record.monolith_db.fqdn
  description = "Stable DNS alias for the RDS instance inside the VPC"
}
