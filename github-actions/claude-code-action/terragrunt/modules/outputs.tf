# outputs.tf - Output values from Claude Code Action infrastructure

output "iam_role_arn" {
  description = "ARN of the IAM role for Claude Code Action"
  value       = aws_iam_role.claude_code_actions_role.arn
}

output "iam_role_name" {
  description = "Name of the IAM role for Claude Code Action"
  value       = aws_iam_role.claude_code_actions_role.name
}

output "bedrock_policy_arn" {
  description = "ARN of the Bedrock access policy"
  value       = aws_iam_policy.bedrock_claude_policy.arn
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for Claude Code Action"
  value       = aws_s3_bucket.claude_code_actions_bucket.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for Claude Code Action"
  value       = aws_s3_bucket.claude_code_actions_bucket.arn
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.claude_code_actions_logs.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.claude_code_actions_logs.arn
}

output "aws_region" {
  description = "AWS region where resources are deployed"
  value       = var.aws_region
}

output "account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "project_name" {
  description = "Project name"
  value       = var.project_name
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}
