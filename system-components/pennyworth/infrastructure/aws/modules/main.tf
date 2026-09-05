resource "aws_secretsmanager_secret" "pennyworth_slack" {
  name                    = "system-components/pennyworth/slack"
  description             = "Slack signing secret and bot token for pennyworth"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

# secret value provision (manual, post-merge, mirrors dystopia/monolith's pattern):
# aws secretsmanager put-secret-value \
#   --secret-id system-components/pennyworth/slack \
#   --secret-string '{"signing_secret":"<from Slack app Basic Information page>","bot_token":"<xoxb-... from OAuth & Permissions page>"}'
#
# The Alertmanager shared token is intentionally not managed here — pennyworth
# reads eks/holmesgpt/alertmanager, a secret shared with panicboat/platform's
# own ExternalSecret for the same value (see that repo's
# kubernetes/components/prometheus-operator/production/kustomization/holmes-alertmanager-external-secret.yaml).
# Creating a second Terraform-managed secret here would just be an unsynced
# duplicate of that value.
