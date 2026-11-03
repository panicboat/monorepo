
// Keep Alertmanager outside this module because the platform ExternalSecret owns the shared value.
resource "aws_secretsmanager_secret" "pennyworth_slack" {
  name                    = "system-components/pennyworth/slack"
  description             = "Slack signing secret and bot token for pennyworth"
  recovery_window_in_days = 30
  tags                    = var.common_tags
}

resource "aws_secretsmanager_secret" "pennyworth_github" {
  name                    = "github-app/pennyworth-bot"
  description             = "GitHub App credentials for panicboat-pennyworth-bot"
  recovery_window_in_days = 30
  tags                    = var.common_tags
}
