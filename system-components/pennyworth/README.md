# pennyworth

Relays Slack `@pennyworth` mentions and Alertmanager `severity: critical` alerts
to HolmesGPT's `/api/chat`, posting the investigation result back to Slack.

Design: `docs/superpowers/specs/2026-09-05-holmes-to-pennyworth-rename-design.md`

## Manual setup (cannot be automated)

Slack, GitHub App, and Alertmanager credentials all pre-date this rename and
already exist in Secrets Manager under their original (`holmes`-era) paths.
This service does not provision them — it only reads:

- Slack: `eks/holmesgpt/slack` (`signing_secret`, `bot_token`)
- GitHub App: `github-app/holmes-bot` (`app_id`, `private_key`, `installation_id`)
- Alertmanager: `eks/holmesgpt/alertmanager` (`shared_token`), shared with
  `panicboat/platform`'s own Alertmanager notification config

### 1. Update the existing Slack app (api.slack.com)

The Slack app already exists (installed under the pre-rename name). Update
its settings to match the new identity:

1. Display name: `Alfred Pennyworth`.
2. Event Subscriptions Request URL: `https://pennyworth.panicboat.net/slack/events`.
3. Bot Token Scopes: `app_mentions:read`, `chat:write`, `channels:history`, `groups:history`.
4. Subscribed bot events: `app_mention`.

### 2. Wire Alertmanager (panicboat/platform repo)

Add a route/receiver in `kubernetes/components/prometheus-operator/production/values.yaml.gotmpl`
matching `severity: critical`, with a `webhook_configs` URL of
`https://pennyworth.panicboat.net/alertmanager/webhook?channel=<slack-channel>`
and `http_config.authorization` set to the `shared_token` from
`eks/holmesgpt/alertmanager`.

### 3. GitHub App

Uses the existing `panicboat-holmesgpt-bot` GitHub App — this rename does not
create or rename a GitHub App. Credentials are read from Secrets Manager at
`github-app/holmes-bot`.
