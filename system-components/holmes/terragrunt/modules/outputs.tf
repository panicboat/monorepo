output "slack_secret_arn" {
  value       = aws_secretsmanager_secret.holmes_relay_slack.arn
  description = "AWS Secrets Manager secret ARN for Slack credentials"
}

output "alertmanager_secret_arn" {
  value       = aws_secretsmanager_secret.holmes_relay_alertmanager.arn
  description = "AWS Secrets Manager secret ARN for the Alertmanager shared token"
}
