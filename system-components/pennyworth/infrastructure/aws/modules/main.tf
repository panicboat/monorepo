# pennyworth owns the Slack and GitHub App secret containers below. Both
# were newly created (2026-09-06) with values copied from the pre-rename
# eks/holmesgpt/slack and github-app/holmes-bot secrets, then imported here
# so pennyworth's own Terraform is the source of truth going forward instead
# of panicboat/platform's aws/secrets-manager stack (which had no actual
# consumer for either — see that repo's PR removing them).
#
# Alertmanager (eks/holmesgpt/alertmanager) is intentionally NOT managed
# here — it's genuinely shared with panicboat/platform's own ExternalSecret
# for the same value (see that repo's
# kubernetes/components/prometheus-operator/production/kustomization/holmes-alertmanager-external-secret.yaml).
# Creating a second Terraform-managed secret here would just be an unsynced
# duplicate of that value.

resource "aws_secretsmanager_secret" "pennyworth_slack" {
  name                    = "system-components/pennyworth/slack"
  description             = "Slack signing secret and bot token for pennyworth"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

resource "aws_secretsmanager_secret" "pennyworth_github" {
  name                    = "github-app/holmesgpt-bot"
  description             = "GitHub App credentials for panicboat-holmesgpt-bot"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

# secret value provision (already done manually, 2026-09-06 — copied from the
# pre-rename secrets above). Future rotation:
# aws secretsmanager put-secret-value \
#   --secret-id system-components/pennyworth/slack \
#   --secret-string '{"signing_secret":"<from Slack app Basic Information page>","bot_token":"<xoxb-... from OAuth & Permissions page>"}'
# aws secretsmanager put-secret-value \
#   --secret-id github-app/holmesgpt-bot \
#   --secret-string '{"app_id":"<...>","installation_id":"<...>","private_key":"<...>"}'
