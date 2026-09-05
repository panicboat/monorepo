# holmes

Relays Slack `@holmes` mentions and Alertmanager `severity: critical` alerts
to HolmesGPT's `/api/chat`, posting the investigation result back to Slack.

Design: `docs/superpowers/specs/2026-08-14-holmes-relay-design.md` (panicboat/platform repo)

## Manual setup (cannot be automated)

### 1. Provision secrets (after `terragrunt apply` creates the empty secrets)

```bash
aws secretsmanager put-secret-value \
  --secret-id panicboat/holmes/slack \
  --secret-string '{"signing_secret":"<...>","bot_token":"<xoxb-...>"}'

aws secretsmanager put-secret-value \
  --secret-id panicboat/holmes/alertmanager \
  --secret-string '{"shared_token":"<openssl rand -hex 32>"}'
```

### 2. Create the Slack app (api.slack.com)

1. Create a new app.
2. Event Subscriptions: enable, set Request URL to `https://holmes.panicboat.net/slack/events`.
3. Bot Token Scopes: `app_mentions:read`, `chat:write`, `channels:history`, `groups:history`.
4. Subscribe to bot events: `app_mention`.
5. Install to workspace. Copy the signing secret (Basic Information) and bot token (OAuth & Permissions) into the secret above.

### 3. Wire Alertmanager (panicboat/platform repo)

Add a route/receiver in `kubernetes/components/prometheus-operator/production/values.yaml.gotmpl`
matching `severity: critical`, with a `webhook_configs` URL of
`https://holmes.panicboat.net/alertmanager/webhook?channel=<slack-channel>`
and `http_config.authorization` set to the `shared_token` from the secret above.
See the separate plan: `docs/superpowers/plans/2026-08-14-holmes-relay-alertmanager-route.md` (this plan still
references the old `holmes-relay` naming and `holmes-relay.dystopia.city` hostname — update it to match this
rename when it is executed).
