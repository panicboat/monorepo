# pennyworth

Relays Slack `@pennyworth` mentions and Alertmanager `severity: critical` alerts
to HolmesGPT's `/api/chat`, posting the investigation result back to Slack.

Design: `docs/superpowers/specs/2026-09-05-holmes-to-pennyworth-rename-design.md`

## Manual setup (cannot be automated)

### 1. Provision the Slack secret (after `terragrunt apply` creates it empty)

```bash
aws secretsmanager put-secret-value \
  --secret-id system-components/pennyworth/slack \
  --secret-string '{"signing_secret":"<...>","bot_token":"<xoxb-...>"}'
```

The Alertmanager shared token is not provisioned here — pennyworth reads
`eks/holmesgpt/alertmanager`, a secret shared with `panicboat/platform`'s own
Alertmanager notification config. If that secret doesn't already exist,
provision it there first.

### 2. Create the Slack app (api.slack.com)

1. Create a new app, display name `Alfred Pennyworth`.
2. Event Subscriptions: enable, set Request URL to `https://pennyworth.panicboat.net/slack/events`.
3. Bot Token Scopes: `app_mentions:read`, `chat:write`, `channels:history`, `groups:history`.
4. Subscribe to bot events: `app_mention`.
5. Install to workspace. Copy the signing secret (Basic Information) and bot token (OAuth & Permissions) into the secret above.

### 3. Wire Alertmanager (panicboat/platform repo)

Add a route/receiver in `kubernetes/components/prometheus-operator/production/values.yaml.gotmpl`
matching `severity: critical`, with a `webhook_configs` URL of
`https://pennyworth.panicboat.net/alertmanager/webhook?channel=<slack-channel>`
and `http_config.authorization` set to the `shared_token` from
`eks/holmesgpt/alertmanager`.

### 4. GitHub App

Uses the existing `panicboat-holmesgpt-bot` GitHub App — this rename does not
create or rename a GitHub App. Credentials are read from Secrets Manager at
`github-app/holmesgpt-bot`.
