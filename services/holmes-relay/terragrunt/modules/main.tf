resource "aws_secretsmanager_secret" "holmes_relay_slack" {
  name                    = "panicboat/holmes-relay/slack"
  description             = "Slack signing secret and bot token for holmes-relay"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

resource "aws_secretsmanager_secret" "holmes_relay_alertmanager" {
  name                    = "panicboat/holmes-relay/alertmanager"
  description             = "Shared bearer token for Alertmanager webhook auth on holmes-relay"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

# secret value provision (manual, post-merge, mirrors services/monolith's pattern):
# 1. aws secretsmanager put-secret-value \
#      --secret-id panicboat/holmes-relay/slack \
#      --secret-string '{"signing_secret":"<from Slack app Basic Information page>","bot_token":"<xoxb-... from OAuth & Permissions page>"}'
# 2. aws secretsmanager put-secret-value \
#      --secret-id panicboat/holmes-relay/alertmanager \
#      --secret-string '{"shared_token":"<openssl rand -hex 32>"}'
