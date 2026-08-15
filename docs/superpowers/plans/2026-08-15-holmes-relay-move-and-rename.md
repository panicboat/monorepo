# Move holmes-relay to system-components/holmes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `services/holmes-relay/` to `system-components/holmes/`, renaming every `holmes-relay` reference to `holmes` throughout, and update the monorepo's CI config so the new location is discovered and built correctly.

**Architecture:** This is a mechanical move-and-rename, not new functionality — no code behavior changes. Each task moves and edits a cohesive slice (Go workspace, Kubernetes manifests, Terragrunt, docs, CI config), verified after each step.

**Tech Stack:** Go, Kustomize, Terragrunt/OpenTofu, GitHub Actions.

## Global Constraints

- Naming Map (from the spec, apply exactly — do not invent variants):
  - Directory: `services/holmes-relay/` → `system-components/holmes/`
  - Go module: `github.com/panicboat/monorepo/services/holmes-relay` → `github.com/panicboat/monorepo/system-components/holmes`
  - Docker image: `ghcr.io/panicboat/monorepo/holmes-relay` → `ghcr.io/panicboat/monorepo/holmes`
  - K8s Deployment/Service/ConfigMap/container name: `holmes-relay` → `holmes`
  - K8s Secret: `holmes-relay-slack`/`holmes-relay-alertmanager` → `holmes-slack`/`holmes-alertmanager`
  - AWS Secrets Manager path: `panicboat/holmes-relay/slack`/`panicboat/holmes-relay/alertmanager` → `panicboat/holmes/slack`/`panicboat/holmes/alertmanager`
  - Flux ImagePolicy: `flux-system:holmes-relay` → `flux-system:holmes`
  - HTTPRoute hostname: `holmes-relay.dystopia.city` → `holmes.dystopia.city`
  - Terragrunt state key: `services/holmes-relay/production/terraform.tfstate` → `system-components/holmes/production/terraform.tfstate`
- No behavior change — this plan only moves/renames. Do not touch application logic.
- Design doc: `docs/superpowers/specs/2026-08-15-holmes-relay-move-and-rename-design.md`.

---

## Task 1: Move directory and rename the Go module

**Files:**
- Move: `services/holmes-relay/workspace/` → `system-components/holmes/workspace/` (all files: `*.go`, `go.mod`, `Dockerfile`, `.dockerignore`, `.gitignore`)
- Modify: `system-components/holmes/workspace/go.mod`

**Interfaces:**
- Produces: the Go package now lives at `system-components/holmes/workspace/`, module path `github.com/panicboat/monorepo/system-components/holmes` — consumed by every later task that references this path.

- [ ] **Step 1: Move the whole service directory**

```bash
git mv services/holmes-relay system-components/holmes
```

This one command moves every file (workspace, kubernetes, terragrunt, README) in a single git-tracked rename. Later tasks edit content within the new location — do not run additional `git mv` commands for files already covered by this move.

- [ ] **Step 2: Update the Go module path**

`system-components/holmes/workspace/go.mod` currently reads:

```
module github.com/panicboat/monorepo/services/holmes-relay

go 1.24
```

Change the `module` line to:

```
module github.com/panicboat/monorepo/system-components/holmes
```

(`go 1.24` stays as-is — do not touch the Go version pin.)

- [ ] **Step 3: Verify the build and tests still pass**

Run: `cd system-components/holmes/workspace && go build ./... && go test ./... -v -race -count=1 && gofmt -l .`
Expected: build succeeds, all tests PASS (this package is `package main` with no internal cross-package imports, so moving the directory and changing only the `module` line does not affect how the code resolves internally — this step confirms that assumption holds), `gofmt -l .` prints nothing.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -m "chore(holmes): move services/holmes-relay to system-components/holmes"
```

---

## Task 2: Rename Kubernetes manifests

**Files:**
- Modify: `system-components/holmes/kubernetes/base/deployment.yaml`
- Modify: `system-components/holmes/kubernetes/base/service.yaml`
- Modify: `system-components/holmes/kubernetes/base/configmap.yaml`
- Modify: `system-components/holmes/kubernetes/base/httproute.yaml`
- Modify: `system-components/holmes/kubernetes/base/kustomization.yaml`
- Modify: `system-components/holmes/kubernetes/overlays/production/deployment.yaml`
- Modify: `system-components/holmes/kubernetes/overlays/production/external-secret.yaml`

**Interfaces:**
- Consumes: nothing from Task 1 (independent file set).
- Produces: all K8s resources named `holmes` (not `holmes-relay`), Secrets named `holmes-slack`/`holmes-alertmanager`, hostname `holmes.dystopia.city` — consumed by Task 3's Terragrunt secret names (must match) and referenced in Task 4's README.

- [ ] **Step 1: Rename in base/deployment.yaml**

Replace:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: holmes-relay
  annotations:
    reloader.stakater.com/auto: "true"
spec:
  replicas: 1
  revisionHistoryLimit: 1
  selector:
    matchLabels:
      app: holmes-relay
  template:
    metadata:
      labels:
        app: holmes-relay
    spec:
      containers:
        - name: holmes-relay
          image: ghcr.io/panicboat/monorepo/holmes-relay:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: holmes-relay
            - secretRef:
                name: holmes-relay-slack
            - secretRef:
                name: holmes-relay-alertmanager
```

with:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: holmes
  annotations:
    reloader.stakater.com/auto: "true"
spec:
  replicas: 1
  revisionHistoryLimit: 1
  selector:
    matchLabels:
      app: holmes
  template:
    metadata:
      labels:
        app: holmes
    spec:
      containers:
        - name: holmes
          image: ghcr.io/panicboat/monorepo/holmes:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: holmes
            - secretRef:
                name: holmes-slack
            - secretRef:
                name: holmes-alertmanager
```

- [ ] **Step 2: Rename in base/service.yaml**

Replace:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: holmes-relay
spec:
  selector:
    app: holmes-relay
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

with:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: holmes
spec:
  selector:
    app: holmes
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

- [ ] **Step 3: Rename in base/configmap.yaml**

Replace:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: holmes-relay
data:
  HOLMES_API_URL: http://holmesgpt-holmes.holmesgpt.svc.cluster.local
  HOLMES_MODEL: sonnet-4-6
```

with:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: holmes
data:
  HOLMES_API_URL: http://holmesgpt-holmes.holmesgpt.svc.cluster.local
  HOLMES_MODEL: sonnet-4-6
```

(`HOLMES_API_URL`/`HOLMES_MODEL` are env var keys read by the Go binary — unrelated to the service's own name, do not change these two keys. `holmesgpt-holmes.holmesgpt.svc.cluster.local` is the separate HolmesGPT deployment in `panicboat/platform` — also not part of this rename.)

- [ ] **Step 4: Rename in base/httproute.yaml**

Replace:

```yaml
# Cilium Gateway (= namespace default, listener http:8080) を parentRef、
# host holmes-relay.dystopia.city への traffic を holmes-relay Service:80 に
# backend する。ingress 経路は frontend と同じ: client → ALB (platform 側
# kubernetes/components/cilium/) → cilium-envoy hostNetwork :8080 → 本
# HTTPRoute → holmes-relay。
#
# NOTE: holmes-relay.dystopia.city の DNS/証明書が実際に発行可能か
# (external-dns / cert-manager 側の対象ドメイン設定) は適用前に platform repo
# 側で確認すること。
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: holmes-relay
  namespace: default
spec:
  parentRefs:
    - name: cilium-gateway
      namespace: default
  hostnames:
    - holmes-relay.dystopia.city
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: holmes-relay
          namespace: default
          port: 80
```

with:

```yaml
# Cilium Gateway (= namespace default, listener http:8080) を parentRef、
# host holmes.dystopia.city への traffic を holmes Service:80 に
# backend する。ingress 経路は frontend と同じ: client → ALB (platform 側
# kubernetes/components/cilium/) → cilium-envoy hostNetwork :8080 → 本
# HTTPRoute → holmes。
#
# NOTE: holmes.dystopia.city の DNS/証明書が実際に発行可能か
# (external-dns / cert-manager 側の対象ドメイン設定) は適用前に platform repo
# 側で確認すること。
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: holmes
  namespace: default
spec:
  parentRefs:
    - name: cilium-gateway
      namespace: default
  hostnames:
    - holmes.dystopia.city
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: holmes
          namespace: default
          port: 80
```

- [ ] **Step 5: Rename in base/kustomization.yaml**

Replace:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - configmap.yaml
  - deployment.yaml
  - httproute.yaml
  - service.yaml
labels:
  - pairs:
      app: holmes-relay
```

with:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - configmap.yaml
  - deployment.yaml
  - httproute.yaml
  - service.yaml
labels:
  - pairs:
      app: holmes
```

- [ ] **Step 6: Rename in overlays/production/deployment.yaml**

Replace:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: holmes-relay
spec:
  template:
    spec:
      containers:
        - name: holmes-relay
          image: ghcr.io/panicboat/monorepo/holmes-relay:v0.1.0 # {"$imagepolicy": "flux-system:holmes-relay"}
```

with:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: holmes
spec:
  template:
    spec:
      containers:
        - name: holmes
          image: ghcr.io/panicboat/monorepo/holmes:v0.1.0 # {"$imagepolicy": "flux-system:holmes"}
```

- [ ] **Step 7: Rename in overlays/production/external-secret.yaml**

Replace the entire file:

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: holmes-relay-slack
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: holmes-relay-slack
    creationPolicy: Owner
  data:
    - secretKey: SLACK_SIGNING_SECRET
      remoteRef:
        key: panicboat/holmes-relay/slack
        property: signing_secret
    - secretKey: SLACK_BOT_TOKEN
      remoteRef:
        key: panicboat/holmes-relay/slack
        property: bot_token
---
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: holmes-relay-alertmanager
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: holmes-relay-alertmanager
    creationPolicy: Owner
  data:
    - secretKey: ALERTMANAGER_SHARED_TOKEN
      remoteRef:
        key: panicboat/holmes-relay/alertmanager
        property: shared_token
```

with:

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: holmes-slack
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: holmes-slack
    creationPolicy: Owner
  data:
    - secretKey: SLACK_SIGNING_SECRET
      remoteRef:
        key: panicboat/holmes/slack
        property: signing_secret
    - secretKey: SLACK_BOT_TOKEN
      remoteRef:
        key: panicboat/holmes/slack
        property: bot_token
---
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: holmes-alertmanager
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: holmes-alertmanager
    creationPolicy: Owner
  data:
    - secretKey: ALERTMANAGER_SHARED_TOKEN
      remoteRef:
        key: panicboat/holmes/alertmanager
        property: shared_token
```

- [ ] **Step 8: Verify both base and overlay build**

Run: `cd system-components/holmes/kubernetes/base && kustomize build . && cd ../overlays/production && kustomize build .`
Expected: both produce valid YAML with no `holmes-relay` string anywhere in the output (spot-check: `kustomize build system-components/holmes/kubernetes/overlays/production | grep holmes-relay` from the repo root should print nothing).

- [ ] **Step 9: Commit**

```bash
git add system-components/holmes/kubernetes
git commit -s -m "chore(holmes): rename holmes-relay -> holmes in Kubernetes manifests"
```

---

## Task 3: Rename Terragrunt scaffolding

**Files:**
- Modify: `system-components/holmes/terragrunt/modules/main.tf`
- Modify: `system-components/holmes/terragrunt/modules/outputs.tf`
- Modify: `system-components/holmes/terragrunt/envs/production/terragrunt.hcl`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: AWS Secrets Manager secrets named `panicboat/holmes/slack` and `panicboat/holmes/alertmanager` — must match the `remoteRef.key` values Task 2 already set.

- [ ] **Step 1: Rename in terragrunt/modules/main.tf**

Replace the entire file:

```hcl
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
```

with:

```hcl
resource "aws_secretsmanager_secret" "holmes_slack" {
  name                    = "panicboat/holmes/slack"
  description             = "Slack signing secret and bot token for holmes"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

resource "aws_secretsmanager_secret" "holmes_alertmanager" {
  name                    = "panicboat/holmes/alertmanager"
  description             = "Shared bearer token for Alertmanager webhook auth on holmes"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

# secret value provision (manual, post-merge, mirrors services/monolith's pattern):
# 1. aws secretsmanager put-secret-value \
#      --secret-id panicboat/holmes/slack \
#      --secret-string '{"signing_secret":"<from Slack app Basic Information page>","bot_token":"<xoxb-... from OAuth & Permissions page>"}'
# 2. aws secretsmanager put-secret-value \
#      --secret-id panicboat/holmes/alertmanager \
#      --secret-string '{"shared_token":"<openssl rand -hex 32>"}'
```

- [ ] **Step 2: Rename in terragrunt/modules/outputs.tf**

Replace:

```hcl
output "slack_secret_arn" {
  value       = aws_secretsmanager_secret.holmes_relay_slack.arn
  description = "AWS Secrets Manager secret ARN for Slack credentials"
}

output "alertmanager_secret_arn" {
  value       = aws_secretsmanager_secret.holmes_relay_alertmanager.arn
  description = "AWS Secrets Manager secret ARN for the Alertmanager shared token"
}
```

with:

```hcl
output "slack_secret_arn" {
  value       = aws_secretsmanager_secret.holmes_slack.arn
  description = "AWS Secrets Manager secret ARN for Slack credentials"
}

output "alertmanager_secret_arn" {
  value       = aws_secretsmanager_secret.holmes_alertmanager.arn
  description = "AWS Secrets Manager secret ARN for the Alertmanager shared token"
}
```

- [ ] **Step 3: Update the state key in envs/production/terragrunt.hcl**

In `system-components/holmes/terragrunt/envs/production/terragrunt.hcl`, find:

```hcl
    key            = "services/holmes-relay/${include.env.locals.environment}/terraform.tfstate"
```

Replace with:

```hcl
    key            = "system-components/holmes/${include.env.locals.environment}/terraform.tfstate"
```

Everything else in this file (the `include` blocks, `inputs`) stays unchanged.

- [ ] **Step 4: Verify the plan**

Run: `cd system-components/holmes/terragrunt/envs/production && terragrunt plan`
Expected: this initializes a **new, empty backend state** at the new key (`system-components/holmes/production/terraform.tfstate`) — the old key (`services/holmes-relay/production/terraform.tfstate`) is never written to and had no resources in it (no `terragrunt apply` has ever run for this module — Task 8 of the original holmes-relay plan only ran `plan`). The plan output should show exactly 2 resources to add: `aws_secretsmanager_secret.holmes_slack` (name `panicboat/holmes/slack`) and `aws_secretsmanager_secret.holmes_alertmanager` (name `panicboat/holmes/alertmanager`), 0 to change, 0 to destroy.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/terragrunt
git commit -s -m "chore(holmes): rename holmes-relay -> holmes in Terragrunt scaffolding"
```

---

## Task 4: Update README

**Files:**
- Modify: `system-components/holmes/README.md`

**Interfaces:**
- Consumes: the renamed resources/URLs from Tasks 2-3.

- [ ] **Step 1: Replace the README content**

Replace the entire file:

```markdown
# holmes-relay

Relays Slack `@holmes` mentions and Alertmanager `severity: critical` alerts
to HolmesGPT's `/api/chat`, posting the investigation result back to Slack.

Design: `docs/superpowers/specs/2026-08-14-holmes-relay-design.md` (panicboat/platform repo)

## Manual setup (cannot be automated)

### 1. Provision secrets (after `terragrunt apply` creates the empty secrets)

\`\`\`bash
aws secretsmanager put-secret-value \
  --secret-id panicboat/holmes-relay/slack \
  --secret-string '{"signing_secret":"<...>","bot_token":"<xoxb-...>"}'

aws secretsmanager put-secret-value \
  --secret-id panicboat/holmes-relay/alertmanager \
  --secret-string '{"shared_token":"<openssl rand -hex 32>"}'
\`\`\`

### 2. Create the Slack app (api.slack.com)

1. Create a new app.
2. Event Subscriptions: enable, set Request URL to `https://holmes-relay.dystopia.city/slack/events`.
3. Bot Token Scopes: `app_mentions:read`, `chat:write`, `channels:history`, `groups:history`.
4. Subscribe to bot events: `app_mention`.
5. Install to workspace. Copy the signing secret (Basic Information) and bot token (OAuth & Permissions) into the secret above.

### 3. Wire Alertmanager (panicboat/platform repo)

Add a route/receiver in `kubernetes/components/prometheus-operator/production/values.yaml.gotmpl`
matching `severity: critical`, with a `webhook_configs` URL of
`https://holmes-relay.dystopia.city/alertmanager/webhook?channel=<slack-channel>`
and `http_config.authorization` set to the `shared_token` from the secret above.
See the separate plan: `docs/superpowers/plans/2026-08-14-holmes-relay-alertmanager-route.md`.
```

with:

```markdown
# holmes

Relays Slack `@holmes` mentions and Alertmanager `severity: critical` alerts
to HolmesGPT's `/api/chat`, posting the investigation result back to Slack.

Design: `docs/superpowers/specs/2026-08-14-holmes-relay-design.md` (panicboat/platform repo)

## Manual setup (cannot be automated)

### 1. Provision secrets (after `terragrunt apply` creates the empty secrets)

\`\`\`bash
aws secretsmanager put-secret-value \
  --secret-id panicboat/holmes/slack \
  --secret-string '{"signing_secret":"<...>","bot_token":"<xoxb-...>"}'

aws secretsmanager put-secret-value \
  --secret-id panicboat/holmes/alertmanager \
  --secret-string '{"shared_token":"<openssl rand -hex 32>"}'
\`\`\`

### 2. Create the Slack app (api.slack.com)

1. Create a new app.
2. Event Subscriptions: enable, set Request URL to `https://holmes.dystopia.city/slack/events`.
3. Bot Token Scopes: `app_mentions:read`, `chat:write`, `channels:history`, `groups:history`.
4. Subscribe to bot events: `app_mention`.
5. Install to workspace. Copy the signing secret (Basic Information) and bot token (OAuth & Permissions) into the secret above.

### 3. Wire Alertmanager (panicboat/platform repo)

Add a route/receiver in `kubernetes/components/prometheus-operator/production/values.yaml.gotmpl`
matching `severity: critical`, with a `webhook_configs` URL of
`https://holmes.dystopia.city/alertmanager/webhook?channel=<slack-channel>`
and `http_config.authorization` set to the `shared_token` from the secret above.
See the separate plan: `docs/superpowers/plans/2026-08-14-holmes-relay-alertmanager-route.md` (this plan still
references the old `holmes-relay.dystopia.city` hostname and `holmes-relay` naming — update it to match this
rename when it is executed).
```

- [ ] **Step 2: Commit**

```bash
git add system-components/holmes/README.md
git commit -s -m "chore(holmes): rename holmes-relay -> holmes in README"
```

---

## Task 5: Extend workflow-config.yaml for system-components

**Files:**
- Modify: `workflow-config.yaml`

**Interfaces:**
- Produces: a second `stack_conventions` entry with `root: system-components/{service}` — consumed by `panicboat/deploy-actions`' label-dispatcher/label-resolver tooling (external repo, no code changes needed there — verified the underlying `stack_conventions_config.each` loop already iterates generically over all entries).

- [ ] **Step 1: Add the system-components stack convention**

Replace:

```yaml
stack_conventions:
  - root: services/{service}
    stacks:
      - name: docker
        directory: workspace
      # TODO: Define conventions for Terragrunt stacks when we have active Terragrunt targets.
      # - name: terragrunt
      #   directory: terragrunt/envs/{environment}
      #   required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: kubernetes
        directory: kubernetes/overlays/{environment}
```

with:

```yaml
stack_conventions:
  - root: services/{service}
    stacks:
      - name: docker
        directory: workspace
      # TODO: Define conventions for Terragrunt stacks when we have active Terragrunt targets.
      # - name: terragrunt
      #   directory: terragrunt/envs/{environment}
      #   required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: kubernetes
        directory: kubernetes/overlays/{environment}
  - root: system-components/{service}
    stacks:
      - name: docker
        directory: workspace
      # TODO: Define conventions for Terragrunt stacks when we have active Terragrunt targets.
      # - name: terragrunt
      #   directory: terragrunt/envs/{environment}
      #   required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: kubernetes
        directory: kubernetes/overlays/{environment}
```

- [ ] **Step 2: Validate the config**

Run: `cd /Users/takanokenichi/GitHub/panicboat/deploy-actions/action-scripts/config-manager && bin/config-manager validate` with the `WORKFLOW_CONFIG_PATH` (or equivalent env var the CLI reads — check `bin/config-manager --help` or `config_client.rb` if the path isn't auto-discovered) pointed at this repo's `workflow-config.yaml`.
Expected: validation passes, no schema errors. If the `config-manager` CLI cannot be run locally (missing Ruby gems, wrong working directory, etc.), skip this step and rely on Task 7's Draft PR to surface any `label-dispatcher`/`label-resolver` failures in CI instead — note this explicitly in the PR description.

- [ ] **Step 3: Commit**

```bash
git add workflow-config.yaml
git commit -s -m "chore(workflow-config): add system-components stack convention"
```

---

## Task 6: Fix the services/ hardcoding in auto-release--trigger.yaml

**Files:**
- Modify: `.github/workflows/auto-release--trigger.yaml`

**Interfaces:**
- Consumes: the `detect-component` job's existing `service` output (parsed from the release tag, e.g. `holmes-v0.1.0` → `holmes`).
- Produces: a new `working-directory` output on the `detect-component` job, consumed by the `container-build` job's `working-directory` input (replacing the old hardcoded `services/${{ ... }}/workspace` string).

- [ ] **Step 1: Add a working-directory resolution step**

Replace:

```yaml
jobs:
  detect-component:
    runs-on: ubuntu-latest
    outputs:
      service: ${{ steps.parse.outputs.service }}
      version: ${{ steps.parse.outputs.version }}
    steps:
      - name: Parse tag
        id: parse
        env:
          TAG: ${{ github.event.release.tag_name || inputs.tag }}
        run: |
          set -euo pipefail
          if [[ ! "$TAG" =~ ^([a-z-]+)-v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
            echo "::error::Tag '$TAG' does not match expected pattern <service>-v<X.Y.Z>"
            exit 1
          fi
          SERVICE="${BASH_REMATCH[1]}"
          VERSION="v${BASH_REMATCH[2]}"
          echo "service=$SERVICE" >> "$GITHUB_OUTPUT"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"

  container-build:
    needs: detect-component
    concurrency:
      group: image-build-${{ needs.detect-component.outputs.service }}-${{ github.sha }}
      cancel-in-progress: false
    uses: ./.github/workflows/reusable--container-builder.yaml
    with:
      image-name: ${{ needs.detect-component.outputs.service }}
      working-directory: services/${{ needs.detect-component.outputs.service }}/workspace
      app-id: ${{ vars.APP_ID }}
      semver-tag: ${{ needs.detect-component.outputs.version }}
    secrets:
      private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

with:

```yaml
jobs:
  detect-component:
    runs-on: ubuntu-latest
    outputs:
      service: ${{ steps.parse.outputs.service }}
      version: ${{ steps.parse.outputs.version }}
      working-directory: ${{ steps.resolve-dir.outputs.working-directory }}
    steps:
      - name: Parse tag
        id: parse
        env:
          TAG: ${{ github.event.release.tag_name || inputs.tag }}
        run: |
          set -euo pipefail
          if [[ ! "$TAG" =~ ^([a-z-]+)-v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
            echo "::error::Tag '$TAG' does not match expected pattern <service>-v<X.Y.Z>"
            exit 1
          fi
          SERVICE="${BASH_REMATCH[1]}"
          VERSION="v${BASH_REMATCH[2]}"
          echo "service=$SERVICE" >> "$GITHUB_OUTPUT"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - name: Resolve working directory
        id: resolve-dir
        env:
          SERVICE: ${{ steps.parse.outputs.service }}
        run: |
          set -euo pipefail
          for root in services system-components; do
            if [ -d "$root/$SERVICE/workspace" ]; then
              echo "working-directory=$root/$SERVICE/workspace" >> "$GITHUB_OUTPUT"
              exit 0
            fi
          done
          echo "::error::No workspace directory found for service '$SERVICE' under services/ or system-components/"
          exit 1

  container-build:
    needs: detect-component
    concurrency:
      group: image-build-${{ needs.detect-component.outputs.service }}-${{ github.sha }}
      cancel-in-progress: false
    uses: ./.github/workflows/reusable--container-builder.yaml
    with:
      image-name: ${{ needs.detect-component.outputs.service }}
      working-directory: ${{ needs.detect-component.outputs.working-directory }}
      app-id: ${{ vars.APP_ID }}
      semver-tag: ${{ needs.detect-component.outputs.version }}
    secrets:
      private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

- [ ] **Step 2: Verify the resolution logic locally**

This workflow only runs on `release: published` or manual `workflow_dispatch`, so it cannot be exercised by this PR directly. Simulate the `resolve-dir` step's logic in a local shell to confirm it picks the right directory for both an existing `services/` service and the new `system-components/` one:

```bash
SERVICE=monolith
for root in services system-components; do
  if [ -d "$root/$SERVICE/workspace" ]; then
    echo "working-directory=$root/$SERVICE/workspace"
    break
  fi
done
```

Expected: prints `working-directory=services/monolith/workspace`.

```bash
SERVICE=holmes
for root in services system-components; do
  if [ -d "$root/$SERVICE/workspace" ]; then
    echo "working-directory=$root/$SERVICE/workspace"
    break
  fi
done
```

Expected: prints `working-directory=system-components/holmes/workspace`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/auto-release--trigger.yaml
git commit -s -m "fix(auto-release-trigger): resolve working-directory instead of hardcoding services/"
```

---

## Task 7: Open Draft PR

**Files:** none (git/GitHub operations only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin chore/holmes-relay-system-components
```

- [ ] **Step 2: Open a Draft PR**

```bash
gh pr create --draft --title "chore(holmes): move services/holmes-relay to system-components/holmes" --body "$(cat <<'EOF'
## Summary
- Move services/holmes-relay/ to system-components/holmes/ — internal ops tools now live outside the toC services/ tree.
- Rename holmes-relay -> holmes throughout (Go module, Docker image, K8s resource names, Secrets Manager paths, Terragrunt state key, README).
- Add a system-components/{service} stack_conventions entry to workflow-config.yaml (the underlying deploy-actions tooling already iterates this list generically — no changes needed in that repo).
- Fix auto-release--trigger.yaml's hardcoded services/ working-directory: it now resolves services/ vs system-components/ dynamically.

## Test plan
- [ ] `go test ./...` passes in `system-components/holmes/workspace`
- [ ] `kustomize build` succeeds for both base and production overlay, no `holmes-relay` string remains
- [ ] `terragrunt plan` succeeds against the new state key (2 secrets to add, 0 to change/destroy)
- [ ] After merge: this repo's own label-dispatcher/label-resolver Actions runs on the merge commit will exercise the new stack_conventions entry for real — watch for failures
- [ ] The panicboat/platform repo's Alertmanager route plan (docs/superpowers/plans/2026-08-14-holmes-relay-alertmanager-route.md) references the old hostname/naming and needs updating before it's executed

Design: docs/superpowers/specs/2026-08-15-holmes-relay-move-and-rename-design.md
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Self-Review Notes

- **Spec coverage**: directory move (Task 1), Kubernetes rename (Task 2), Terragrunt rename (Task 3), README (Task 4), workflow-config.yaml extension (Task 5), auto-release--trigger.yaml fix (Task 6) all covered. The spec's "IAM: reuse the existing environment-level role" decision requires no task — there's nothing to build.
- **Placeholder scan**: no TBD/TODO markers introduced by this plan (the one `# TODO:` line in workflow-config.yaml is pre-existing content being carried forward unchanged, not a plan placeholder).
- **Type/naming consistency**: the Terraform resource names (`aws_secretsmanager_secret.holmes_slack`/`holmes_alertmanager`, Task 3) match the `remoteRef.key` values in the ExternalSecret (Task 2) and the K8s Secret names referenced by the Deployment's `envFrom` (Task 2) — all three point at `panicboat/holmes/slack` and `panicboat/holmes/alertmanager` consistently.
