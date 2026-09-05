output "slack_secret_arn" {
  value       = aws_secretsmanager_secret.pennyworth_slack.arn
  description = "AWS Secrets Manager secret ARN for Slack credentials"
}
