# Rename holmes to pennyworth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `system-components/holmes` to `system-components/pennyworth` across the Go module, Docker image, all Kubernetes/Flux/Terraform resources, release-please config, and documentation — plus fix a discovered secret-path mismatch along the way.

**Architecture:** This is a mechanical, cross-cutting rename with no behavior change. Tasks 1-2 rename the Go module, binaries, and the HolmesGPT client package (`internal/clients/holmes` → `internal/clients/holmesgpt`, so the package name stops being ambiguous between "the service" and "the HolmesGPT client" now that the service itself is `pennyworth`). Tasks 3-6 rename the same identifiers across Kubernetes, Flux, Terraform, and release-please, and fold in the secret-path redesign from the spec's Verified Findings (Slack secret moves to a real, referenced path; the orphaned Alertmanager Terraform resource is deleted in favor of the existing shared `eks/holmesgpt/alertmanager` key; GitHub App secret path corrected to match the app's real name). Task 7 rewrites the README to match.

**Tech Stack:** Go 1.24 (stdlib only), Kubernetes/Kustomize, Terraform/Terragrunt, Flux CD, release-please, GitHub Actions (unchanged, generic `{service}` stack_conventions already handle any directory name).

**Spec:** `docs/superpowers/specs/2026-09-05-holmes-to-pennyworth-rename-design.md`

## Global Constraints

- HolmesGPT itself (the `panicboat/platform` repo, Helm chart, namespace `holmesgpt`) is never touched by this plan — no files outside this monorepo are modified.
- The GitHub App `panicboat-holmesgpt-bot` itself is never renamed — only the Secrets Manager path referencing it changes, to match its real name.
- The Alertmanager shared token stays at `eks/holmesgpt/alertmanager` — this key is shared with `panicboat/platform`'s own ExternalSecret for the same value, so it cannot change without touching that repo (out of scope here).
- The `{product}/{component}/{role}` secret-path convention (`system-components/pennyworth/slack`) is scoped to this plan only — it is not applied to any other component or to `panicboat/platform`.
- Past `docs/superpowers/plans/*holmes*.md` and `docs/superpowers/specs/*holmes*-design.md` files are historical records of completed work and are never modified by this plan.
- release-please's version resets to `0.0.0` for the renamed component — `pennyworth` is treated as a new component, not a continuation of `holmes`'s `0.6.1` history.
- No test assertions or business logic change anywhere in this plan — every diff should be identifier renames, path changes, and string literal updates only.

---

## File Structure

- Move: `system-components/holmes/` → `system-components/pennyworth/`
- Move: `system-components/pennyworth/internal/clients/holmes/` → `.../internal/clients/holmesgpt/`
- Move: `clusters/production/system-components/holmes/` → `clusters/production/system-components/pennyworth/`
- Modify: `go.mod`, `Dockerfile`, `.gitignore`
- Modify: `cmd/slack/main.go`, `cmd/alertmanager/main.go`
- Modify: `internal/config/config.go`, `internal/config/config_test.go`
- Modify: `internal/clients/holmesgpt/client.go`, `internal/clients/holmesgpt/client_test.go`
- Modify: `internal/handlers/slack/handler.go`, `internal/handlers/slack/handler_test.go`
- Modify: `internal/handlers/alertmanager/handler.go`, `internal/handlers/alertmanager/handler_test.go`
- Modify: `kubernetes/base/{configmap,deployment-slack,deployment-alertmanager,service-slack,service-alertmanager,ingress}.yaml`
- Modify: `kubernetes/overlays/production/{deployment,external-secret}.yaml`
- Modify: `clusters/production/system-components/pennyworth/{image-repository,image-policy,image-automation,service}.yaml`
- Modify: `infrastructure/aws/modules/main.tf`, `infrastructure/aws/modules/outputs.tf`
- Modify: `infrastructure/aws/production/env.hcl`, `infrastructure/aws/production/terragrunt.hcl`
- Modify: `.github/release-please-config.json`, `.github/release-please-manifest.json`
- Modify: `README.md`

---

### Task 1: Rename the directory, Go module, and binary names

**Files:**
- Move: `system-components/holmes/` → `system-components/pennyworth/`
- Modify: `system-components/pennyworth/go.mod`
- Modify: `system-components/pennyworth/Dockerfile`
- Modify: `system-components/pennyworth/.gitignore`
- Modify: `system-components/pennyworth/cmd/slack/main.go`
- Modify: `system-components/pennyworth/cmd/alertmanager/main.go`
- Modify: `system-components/pennyworth/internal/handlers/slack/handler.go`
- Modify: `system-components/pennyworth/internal/handlers/slack/handler_test.go`
- Modify: `system-components/pennyworth/internal/handlers/alertmanager/handler.go`
- Modify: `system-components/pennyworth/internal/handlers/alertmanager/handler_test.go`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: module path `github.com/panicboat/monorepo/system-components/pennyworth`, binaries `pennyworth-slack`/`pennyworth-alertmanager`. `internal/clients/holmes` (the HolmesGPT client sub-package) is intentionally left untouched here — its import path becomes `.../system-components/pennyworth/internal/clients/holmes` (module prefix renamed, package name not yet) and Task 2 renames it to `holmesgpt`. This is a deliberate intermediate state: the build must be green at the end of this task even though `holmes` still appears as the client sub-package name.

- [ ] **Step 1: Move the directory**

```bash
git mv system-components/holmes system-components/pennyworth
cd system-components/pennyworth
```

- [ ] **Step 2: Rewrite `go.mod`**

Replace the full contents of `go.mod`:

```
module github.com/panicboat/monorepo/system-components/pennyworth

go 1.24.13
```

- [ ] **Step 3: Rewrite the Dockerfile**

Replace the full contents of `Dockerfile`:

```dockerfile
FROM golang:1.24.13-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/pennyworth-slack ./cmd/slack
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/pennyworth-alertmanager ./cmd/alertmanager

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/pennyworth-slack /pennyworth-slack
COPY --from=builder /out/pennyworth-alertmanager /pennyworth-alertmanager
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/pennyworth-slack"]
```

- [ ] **Step 4: Rewrite `.gitignore`**

Replace the full contents of `.gitignore`:

```
/pennyworth-slack
/pennyworth-alertmanager
```

- [ ] **Step 5: Update import paths and log strings in the 6 affected `.go` files**

Run this from `system-components/pennyworth/`:

```bash
sed -i '' \
  -e 's#github.com/panicboat/monorepo/system-components/holmes/#github.com/panicboat/monorepo/system-components/pennyworth/#g' \
  cmd/slack/main.go \
  cmd/alertmanager/main.go \
  internal/handlers/slack/handler.go \
  internal/handlers/slack/handler_test.go \
  internal/handlers/alertmanager/handler.go \
  internal/handlers/alertmanager/handler_test.go

sed -i '' \
  -e 's/holmes-slack listening/pennyworth-slack listening/' \
  cmd/slack/main.go

sed -i '' \
  -e 's/holmes-alertmanager listening/pennyworth-alertmanager listening/' \
  cmd/alertmanager/main.go
```

Verify no accidental double-replace or missed spots:

```bash
grep -rn "system-components/holmes" cmd internal --include="*.go"
```

Expected: no output (only `internal/clients/holmes` itself, i.e. `.../internal/clients/holmes` as an import suffix, should remain — verify with the next command).

```bash
grep -rn "clients/holmes" cmd internal --include="*.go"
```

Expected: 6 matches (the import lines for the HolmesGPT client sub-package, still named `holmes` — this is the deliberate intermediate state Task 2 resolves).

- [ ] **Step 6: Build and test**

```bash
go build ./... && go vet ./... && go test ./... -v -race -count=1
```

Expected: PASS. All packages build and all existing tests pass unchanged — this task only renamed paths and binary names, no logic changed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -s -m "refactor(system-components/holmes): rename directory, module, and binaries to pennyworth"
```

---

### Task 2: Rename the HolmesGPT client package and unify related identifiers

**Files:**
- Move: `system-components/pennyworth/internal/clients/holmes/` → `.../internal/clients/holmesgpt/`
- Modify: `internal/clients/holmesgpt/client.go`
- Modify: `internal/clients/holmesgpt/client_test.go`
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `cmd/slack/main.go`
- Modify: `cmd/alertmanager/main.go`
- Modify: `internal/handlers/slack/handler.go`
- Modify: `internal/handlers/slack/handler_test.go`
- Modify: `internal/handlers/alertmanager/handler.go`
- Modify: `internal/handlers/alertmanager/handler_test.go`

**Interfaces:**
- Consumes: Task 1's renamed module path and green build
- Produces: `internal/clients/holmesgpt` package (same `New`, `Chat`, `Investigate` API — only the package name changed). `config.Config.HolmesGPTAPIURL`/`HolmesGPTModel` fields, env vars `HOLMESGPT_API_URL`/`HOLMESGPT_MODEL`. `Handler.HolmesGPT` field name (both `slack.Handler` and `alertmanager.Handler`) — this is the last task that touches these identifiers; every later task treats them as final.

- [ ] **Step 1: Move the client sub-package**

```bash
cd system-components/pennyworth
git mv internal/clients/holmes internal/clients/holmesgpt
```

- [ ] **Step 2: Update the package declaration in the moved files**

```bash
sed -i '' 's/^package holmes$/package holmesgpt/' internal/clients/holmesgpt/client.go internal/clients/holmesgpt/client_test.go
```

- [ ] **Step 3: Rewrite `internal/config/config.go`**

Replace the full contents:

```go
package config

import (
	"fmt"
	"os"
)

type Config struct {
	SlackSigningSecret      string
	SlackBotToken           string
	AlertmanagerToken       string
	HolmesGPTAPIURL         string
	HolmesGPTModel          string
	GitHubAppID             string
	GitHubAppPrivateKey     string
	GitHubAppInstallationID string
}

func fromEnv() Config {
	cfg := Config{
		SlackSigningSecret:      os.Getenv("SLACK_SIGNING_SECRET"),
		SlackBotToken:           os.Getenv("SLACK_BOT_TOKEN"),
		AlertmanagerToken:       os.Getenv("ALERTMANAGER_SHARED_TOKEN"),
		HolmesGPTAPIURL:         os.Getenv("HOLMESGPT_API_URL"),
		HolmesGPTModel:          os.Getenv("HOLMESGPT_MODEL"),
		GitHubAppID:             os.Getenv("GITHUB_APP_ID"),
		GitHubAppPrivateKey:     os.Getenv("GITHUB_APP_PRIVATE_KEY"),
		GitHubAppInstallationID: os.Getenv("GITHUB_APP_INSTALLATION_ID"),
	}
	if cfg.HolmesGPTModel == "" {
		cfg.HolmesGPTModel = "sonnet-4-6"
	}
	return cfg
}

// LoadSlack loads and validates the environment variables the Slack
// mention process needs: verifying/posting to Slack and creating GitHub
// issues.
func LoadSlack() (Config, error) {
	cfg := fromEnv()
	if cfg.SlackSigningSecret == "" {
		return cfg, fmt.Errorf("SLACK_SIGNING_SECRET is required")
	}
	if cfg.SlackBotToken == "" {
		return cfg, fmt.Errorf("SLACK_BOT_TOKEN is required")
	}
	if cfg.HolmesGPTAPIURL == "" {
		return cfg, fmt.Errorf("HOLMESGPT_API_URL is required")
	}
	if cfg.GitHubAppID == "" {
		return cfg, fmt.Errorf("GITHUB_APP_ID is required")
	}
	if cfg.GitHubAppPrivateKey == "" {
		return cfg, fmt.Errorf("GITHUB_APP_PRIVATE_KEY is required")
	}
	if cfg.GitHubAppInstallationID == "" {
		return cfg, fmt.Errorf("GITHUB_APP_INSTALLATION_ID is required")
	}
	return cfg, nil
}

// LoadAlertmanager loads and validates the environment variables the
// Alertmanager relay process needs: verifying the webhook and posting
// to Slack. It never requires GitHub App credentials.
func LoadAlertmanager() (Config, error) {
	cfg := fromEnv()
	if cfg.AlertmanagerToken == "" {
		return cfg, fmt.Errorf("ALERTMANAGER_SHARED_TOKEN is required")
	}
	if cfg.SlackBotToken == "" {
		return cfg, fmt.Errorf("SLACK_BOT_TOKEN is required")
	}
	if cfg.HolmesGPTAPIURL == "" {
		return cfg, fmt.Errorf("HOLMESGPT_API_URL is required")
	}
	return cfg, nil
}
```

- [ ] **Step 4: Rewrite `internal/config/config_test.go`**

Replace the full contents:

```go
package config

import (
	"os"
	"testing"
)

func setEnv(t *testing.T, key, value string) {
	t.Helper()
	old, hadOld := os.LookupEnv(key)
	os.Setenv(key, value)
	t.Cleanup(func() {
		if hadOld {
			os.Setenv(key, old)
		} else {
			os.Unsetenv(key)
		}
	})
}

func unsetEnv(t *testing.T, key string) {
	t.Helper()
	old, hadOld := os.LookupEnv(key)
	os.Unsetenv(key)
	t.Cleanup(func() {
		if hadOld {
			os.Setenv(key, old)
		}
	})
}

func TestLoadSlack_AllRequiredPresent(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	setEnv(t, "GITHUB_APP_ID", "123")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")
	unsetEnv(t, "HOLMESGPT_MODEL")
	unsetEnv(t, "ALERTMANAGER_SHARED_TOKEN")

	cfg, err := LoadSlack()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HolmesGPTModel != "sonnet-4-6" {
		t.Errorf("expected default model sonnet-4-6, got %q", cfg.HolmesGPTModel)
	}
	if cfg.GitHubAppID != "123" {
		t.Errorf("expected GitHubAppID %q, got %q", "123", cfg.GitHubAppID)
	}
	if cfg.GitHubAppPrivateKey != "test-key" {
		t.Errorf("expected GitHubAppPrivateKey %q, got %q", "test-key", cfg.GitHubAppPrivateKey)
	}
	if cfg.GitHubAppInstallationID != "456" {
		t.Errorf("expected GitHubAppInstallationID %q, got %q", "456", cfg.GitHubAppInstallationID)
	}
}

func TestLoadSlack_MissingSigningSecret(t *testing.T) {
	unsetEnv(t, "SLACK_SIGNING_SECRET")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://example.invalid")
	setEnv(t, "GITHUB_APP_ID", "123")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")

	if _, err := LoadSlack(); err == nil {
		t.Fatal("expected error when SLACK_SIGNING_SECRET is missing, got nil")
	}
}

func TestLoadSlack_MissingGitHubAppID(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://example.invalid")
	unsetEnv(t, "GITHUB_APP_ID")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")

	if _, err := LoadSlack(); err == nil {
		t.Fatal("expected error when GITHUB_APP_ID is missing, got nil")
	}
}

func TestLoadSlack_DoesNotRequireAlertmanagerToken(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://example.invalid")
	setEnv(t, "GITHUB_APP_ID", "123")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")
	unsetEnv(t, "ALERTMANAGER_SHARED_TOKEN")

	if _, err := LoadSlack(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadAlertmanager_AllRequiredPresent(t *testing.T) {
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	unsetEnv(t, "HOLMESGPT_MODEL")
	unsetEnv(t, "SLACK_SIGNING_SECRET")
	unsetEnv(t, "GITHUB_APP_ID")

	cfg, err := LoadAlertmanager()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HolmesGPTModel != "sonnet-4-6" {
		t.Errorf("expected default model sonnet-4-6, got %q", cfg.HolmesGPTModel)
	}
	if cfg.AlertmanagerToken != "am-token" {
		t.Errorf("expected AlertmanagerToken %q, got %q", "am-token", cfg.AlertmanagerToken)
	}
}

func TestLoadAlertmanager_MissingToken(t *testing.T) {
	unsetEnv(t, "ALERTMANAGER_SHARED_TOKEN")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://example.invalid")

	if _, err := LoadAlertmanager(); err == nil {
		t.Fatal("expected error when ALERTMANAGER_SHARED_TOKEN is missing, got nil")
	}
}

func TestLoadAlertmanager_DoesNotRequireGitHubApp(t *testing.T) {
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://example.invalid")
	unsetEnv(t, "GITHUB_APP_ID")
	unsetEnv(t, "GITHUB_APP_PRIVATE_KEY")
	unsetEnv(t, "GITHUB_APP_INSTALLATION_ID")
	unsetEnv(t, "SLACK_SIGNING_SECRET")

	if _, err := LoadAlertmanager(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
```

- [ ] **Step 5: Update `cmd/slack/main.go`**

Replace the full contents:

```go
package main

import (
	"log"
	"net/http"

	"github.com/panicboat/monorepo/system-components/pennyworth/internal/clients/github"
	"github.com/panicboat/monorepo/system-components/pennyworth/internal/clients/holmesgpt"
	"github.com/panicboat/monorepo/system-components/pennyworth/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/pennyworth/internal/config"
	slackhandler "github.com/panicboat/monorepo/system-components/pennyworth/internal/handlers/slack"
)

func main() {
	cfg, err := config.LoadSlack()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	holmesGPTClient := holmesgpt.New(cfg.HolmesGPTAPIURL, cfg.HolmesGPTModel)
	slackClient := slack.New(cfg.SlackBotToken)
	githubClient, err := github.New(cfg.GitHubAppID, cfg.GitHubAppPrivateKey, cfg.GitHubAppInstallationID)
	if err != nil {
		log.Fatalf("github client error: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/slack/events", &slackhandler.Handler{Cfg: cfg, HolmesGPT: holmesGPTClient, Client: slackClient, GitHub: githubClient})

	addr := ":8080"
	log.Printf("pennyworth-slack listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 6: Update `cmd/alertmanager/main.go`**

Replace the full contents:

```go
package main

import (
	"log"
	"net/http"

	"github.com/panicboat/monorepo/system-components/pennyworth/internal/clients/holmesgpt"
	"github.com/panicboat/monorepo/system-components/pennyworth/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/pennyworth/internal/config"
	"github.com/panicboat/monorepo/system-components/pennyworth/internal/handlers/alertmanager"
)

func main() {
	cfg, err := config.LoadAlertmanager()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	holmesGPTClient := holmesgpt.New(cfg.HolmesGPTAPIURL, cfg.HolmesGPTModel)
	slackClient := slack.New(cfg.SlackBotToken)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/alertmanager/webhook", &alertmanager.Handler{Cfg: cfg, HolmesGPT: holmesGPTClient, Client: slackClient})

	addr := ":8080"
	log.Printf("pennyworth-alertmanager listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 7: Rename the `Holmes` field to `HolmesGPT` in both handlers**

In `internal/handlers/slack/handler.go`:
- Change the field declaration `Holmes investigator` (in `type Handler struct`) to `HolmesGPT investigator`.
- Change the call site `response, err := h.Holmes.Chat(ask)` to `response, err := h.HolmesGPT.Chat(ask)`.

In `internal/handlers/alertmanager/handler.go`:
- Change the field declaration `Holmes investigator` (in `type Handler struct`) to `HolmesGPT investigator`.
- Change the call site `analysis, err := h.Holmes.Investigate(ask)` to `analysis, err := h.HolmesGPT.Investigate(ask)`.

Do not rename the `investigator` interface type itself, and do not touch any other function in either file (`ServeHTTP`, `parseActionEnvelope`, `dispatchAction`, `handleCreateIssue`, `stripCodeFence` in slack's handler; `investigateAlert`, `findNotificationTs`, `searchByFingerprint`, `buildFallbackNotification`, `buildAlertAsk` in alertmanager's handler are all unaffected).

- [ ] **Step 8: Update the two handler test files**

Both `internal/handlers/slack/handler_test.go` and `internal/handlers/alertmanager/handler_test.go` alias-import the HolmesGPT client package as `holmesclient` and set it via a `Holmes:` struct field key at every `&Handler{...}` literal (10 occurrences in the slack test file, 3 in the alertmanager test file). Run this from `system-components/pennyworth/`:

```bash
sed -i '' \
  -e 's#holmesclient "github.com/panicboat/monorepo/system-components/pennyworth/internal/clients/holmesgpt"#holmesgptclient "github.com/panicboat/monorepo/system-components/pennyworth/internal/clients/holmesgpt"#' \
  -e 's/holmesclient\./holmesgptclient./g' \
  -e 's/Holmes: holmesgptclient/HolmesGPT: holmesgptclient/g' \
  internal/handlers/slack/handler_test.go internal/handlers/alertmanager/handler_test.go
```

This leaves local variable names like `holmesServer` and `holmesCalled` unchanged (they're fake-HTTP-server bookkeeping local to each test, not identifiers this task renames), and leaves the import path already updated by Task 1's sed run unaffected.

Verify no `Holmes:` struct-literal key or bare `holmesclient` reference remains:

```bash
grep -n "Holmes:\|holmesclient" internal/handlers/slack/handler_test.go internal/handlers/alertmanager/handler_test.go
```

Expected: no output.

- [ ] **Step 9: Build and test**

```bash
go build ./... && go vet ./... && go test ./... -v -race -count=1
```

Expected: PASS. Every test's assertions are unchanged from before this task — only identifiers moved.

- [ ] **Step 10: Final grep sweep for this task's scope**

```bash
grep -rn "package holmes$\|clients/holmes\"\|HolmesAPIURL\|HolmesModel\|HOLMES_API_URL\|HOLMES_MODEL\|holmesClient\b\|Holmes investigator\|h\.Holmes\b" --include="*.go" .
```

Expected: no output. If anything matches, it was missed by the sed steps above and must be fixed before committing.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -s -m "refactor(system-components/holmes): rename HolmesGPT client package and unify related identifiers"
```

---

### Task 3: Update Kubernetes manifests (base + overlays/production)

**Files:**
- Modify: `system-components/pennyworth/kubernetes/base/configmap.yaml`
- Modify: `system-components/pennyworth/kubernetes/base/deployment-slack.yaml`
- Modify: `system-components/pennyworth/kubernetes/base/deployment-alertmanager.yaml`
- Modify: `system-components/pennyworth/kubernetes/base/service-slack.yaml`
- Modify: `system-components/pennyworth/kubernetes/base/service-alertmanager.yaml`
- Modify: `system-components/pennyworth/kubernetes/base/ingress.yaml`
- Modify: `system-components/pennyworth/kubernetes/overlays/production/deployment.yaml`
- Modify: `system-components/pennyworth/kubernetes/overlays/production/external-secret.yaml`

**Interfaces:**
- Consumes: Task 1/2's renamed binaries (`/pennyworth-slack`, `/pennyworth-alertmanager`) and env vars (`HOLMESGPT_API_URL`, `HOLMESGPT_MODEL`)
- Produces: `Deployment/pennyworth-slack`, `Deployment/pennyworth-alertmanager`, `Service/pennyworth-slack`, `Service/pennyworth-alertmanager`, `ConfigMap/pennyworth`, `Secret/pennyworth-slack`, `Secret/pennyworth-alertmanager`, `Secret/pennyworth-github`, `Ingress/pennyworth`. Task 5 (Flux) references the image and `$imagepolicy` name this task sets.
- Note: `kubernetes/base/kustomization.yaml` and `kubernetes/overlays/production/kustomization.yaml` reference resources by filename, not by the `holmes`/`pennyworth` name inside them — since no filenames change in this task, neither kustomization file needs editing. Verify this assumption in Step 8.

Run all commands and file edits in this task from `system-components/pennyworth/` (`cd system-components/pennyworth` first if starting a fresh shell).

- [ ] **Step 1: Rewrite `kubernetes/base/configmap.yaml`**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: pennyworth
data:
  HOLMESGPT_API_URL: http://holmesgpt-holmes.holmesgpt.svc.cluster.local
  HOLMESGPT_MODEL: sonnet-4-6
```

- [ ] **Step 2: Rewrite `kubernetes/base/deployment-slack.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pennyworth-slack
  annotations:
    reloader.stakater.com/auto: "true"
spec:
  replicas: 1
  revisionHistoryLimit: 1
  selector:
    matchLabels:
      app: pennyworth-slack
  template:
    metadata:
      labels:
        app: pennyworth-slack
    spec:
      containers:
        - name: pennyworth-slack
          image: ghcr.io/panicboat/monorepo/pennyworth:latest
          imagePullPolicy: IfNotPresent
          command: ["/pennyworth-slack"]
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: pennyworth
            - secretRef:
                name: pennyworth-slack
            - secretRef:
                name: pennyworth-github
```

- [ ] **Step 3: Rewrite `kubernetes/base/deployment-alertmanager.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pennyworth-alertmanager
  annotations:
    reloader.stakater.com/auto: "true"
spec:
  replicas: 1
  revisionHistoryLimit: 1
  selector:
    matchLabels:
      app: pennyworth-alertmanager
  template:
    metadata:
      labels:
        app: pennyworth-alertmanager
    spec:
      containers:
        - name: pennyworth-alertmanager
          image: ghcr.io/panicboat/monorepo/pennyworth:latest
          imagePullPolicy: IfNotPresent
          command: ["/pennyworth-alertmanager"]
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: pennyworth
            - secretRef:
                name: pennyworth-slack
            - secretRef:
                name: pennyworth-alertmanager
```

- [ ] **Step 4: Rewrite `kubernetes/base/service-slack.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: pennyworth-slack
spec:
  selector:
    app: pennyworth-slack
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

- [ ] **Step 5: Rewrite `kubernetes/base/service-alertmanager.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: pennyworth-alertmanager
spec:
  selector:
    app: pennyworth-alertmanager
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

- [ ] **Step 6: Rewrite `kubernetes/base/ingress.yaml`**

```yaml
# pennyworth takes direct POSTs from Slack and Alertmanager, so unlike the
# oauth2-proxy-fronted monitoring-uis Ingresses it has no auth in front.
# Uses the panicboat.net private-tooling zone, kept separate from the
# public product's dystopia.city / cilium Gateway API path
# (frontend/monolith, still incomplete). Shares the ALB with platform's
# kubernetes/components/cilium application Ingress via group.name:
# application.
#
# healthcheck-path is an Ingress-level annotation applied to every
# target group in this Ingress (both pennyworth-slack and
# pennyworth-alertmanager), so one /healthz setting covers both Services —
# both binaries implement that path.
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pennyworth
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/group.name: application
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /healthz
    alb.ingress.kubernetes.io/healthcheck-port: traffic-port
    alb.ingress.kubernetes.io/ssl-policy: ELBSecurityPolicy-TLS13-1-2-2021-06
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    external-dns.alpha.kubernetes.io/hostname: pennyworth.panicboat.net
spec:
  ingressClassName: alb
  rules:
    - host: pennyworth.panicboat.net
      http:
        paths:
          - path: /slack
            pathType: Prefix
            backend:
              service:
                name: pennyworth-slack
                port:
                  number: 80
          - path: /alertmanager
            pathType: Prefix
            backend:
              service:
                name: pennyworth-alertmanager
                port:
                  number: 80
```

- [ ] **Step 7: Rewrite `kubernetes/overlays/production/deployment.yaml`**

The image tag uses a placeholder version — the real value gets set by Flux's `ImageUpdateAutomation` (Task 5) once the first `pennyworth-vX.Y.Z` release tag exists (release-please's version resets to `0.0.0` per Global Constraints, so the first real tag will be `pennyworth-v0.1.0` or similar; `v0.0.1` here is never meant to resolve to a real image, it just satisfies the required `image:` field until Flux's Setters strategy overwrites it):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pennyworth-slack
spec:
  template:
    spec:
      containers:
        - name: pennyworth-slack
          image: ghcr.io/panicboat/monorepo/pennyworth:v0.0.1 # {"$imagepolicy": "flux-system:pennyworth"}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pennyworth-alertmanager
spec:
  template:
    spec:
      containers:
        - name: pennyworth-alertmanager
          image: ghcr.io/panicboat/monorepo/pennyworth:v0.0.1 # {"$imagepolicy": "flux-system:pennyworth"}
```

- [ ] **Step 8: Rewrite `kubernetes/overlays/production/external-secret.yaml`**

This also applies the secret-path redesign from the spec's Verified Findings: the Slack secret moves to `system-components/pennyworth/slack` (a real, Terraform-managed path — see Task 6), the Alertmanager secret keeps referencing the existing shared `eks/holmesgpt/alertmanager` key unchanged, and the GitHub secret's key is corrected to `github-app/holmesgpt-bot` to match the app's real name (`panicboat-holmesgpt-bot`):

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: pennyworth-slack
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: pennyworth-slack
    creationPolicy: Owner
  data:
    - secretKey: SLACK_SIGNING_SECRET
      remoteRef:
        key: system-components/pennyworth/slack
        property: signing_secret
    - secretKey: SLACK_BOT_TOKEN
      remoteRef:
        key: system-components/pennyworth/slack
        property: bot_token
---
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: pennyworth-alertmanager
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: pennyworth-alertmanager
    creationPolicy: Owner
  data:
    - secretKey: ALERTMANAGER_SHARED_TOKEN
      remoteRef:
        key: eks/holmesgpt/alertmanager
        property: shared_token
---
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: pennyworth-github
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: pennyworth-github
    creationPolicy: Owner
  data:
    - secretKey: GITHUB_APP_ID
      remoteRef:
        key: github-app/holmesgpt-bot
        property: app_id
    - secretKey: GITHUB_APP_PRIVATE_KEY
      remoteRef:
        key: github-app/holmesgpt-bot
        property: private_key
    - secretKey: GITHUB_APP_INSTALLATION_ID
      remoteRef:
        key: github-app/holmesgpt-bot
        property: installation_id
```

- [ ] **Step 9: Verify `kustomization.yaml` files need no changes, then validate with kustomize**

Read `kubernetes/base/kustomization.yaml` and `kubernetes/overlays/production/kustomization.yaml` — confirm both only list filenames (`deployment-slack.yaml`, `external-secret.yaml`, etc.), none of which changed in this task. No edit needed to either file.

Run:

```bash
kubectl kustomize kubernetes/base
kubectl kustomize kubernetes/overlays/production
```

Expected: both succeed. The base output shows `pennyworth-slack`/`pennyworth-alertmanager` Deployments and Services with matching selectors, ConfigMap `pennyworth`, and an Ingress with the two `/slack`/`/alertmanager` paths under `pennyworth.panicboat.net`. The production overlay output additionally shows the patched image tag on both Deployments and three ExternalSecrets with the ✅ secret paths from Step 8.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -s -m "refactor(system-components/holmes): rename Kubernetes resources to pennyworth and fix secret paths"
```

---

### Task 4: Rename Flux resources (`clusters/production`)

**Files:**
- Move: `clusters/production/system-components/holmes/` → `clusters/production/system-components/pennyworth/`
- Modify: `clusters/production/system-components/pennyworth/image-repository.yaml`
- Modify: `clusters/production/system-components/pennyworth/image-policy.yaml`
- Modify: `clusters/production/system-components/pennyworth/image-automation.yaml`
- Modify: `clusters/production/system-components/pennyworth/service.yaml`

**Interfaces:**
- Consumes: Task 3's `pennyworth` image name and `kubernetes/overlays/production` path
- Produces: Flux `ImageRepository/pennyworth`, `ImagePolicy/pennyworth`, `ImageUpdateAutomation/pennyworth`, `Kustomization/pennyworth` (all in `flux-system` namespace)

Run all commands and file edits in this task from the worktree root (the monorepo layout itself — `clusters/` is a sibling of `system-components/`, not inside it).

- [ ] **Step 1: Move the directory**

```bash
git mv clusters/production/system-components/holmes clusters/production/system-components/pennyworth
```

- [ ] **Step 2: Rewrite `image-repository.yaml`**

```yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageRepository
metadata:
  name: pennyworth
  namespace: flux-system
spec:
  image: ghcr.io/panicboat/monorepo/pennyworth
  interval: 5m
```

- [ ] **Step 3: Rewrite `image-policy.yaml`**

```yaml
# =============================================================================
# ImagePolicy for pennyworth (= semver tag pattern)
# =============================================================================
# release tag (pennyworth-vX.Y.Z) を起点に build される ghcr semver tag (vX.Y.Z) を
# Flux が pickup する。main push 由来の latest / sha tag は filterTags pattern
# で除外される (= Flux が見るのは semver のみ)。
# =============================================================================
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImagePolicy
metadata:
  name: pennyworth
  namespace: flux-system
  labels:
    service: pennyworth
spec:
  imageRepositoryRef:
    name: pennyworth
  filterTags:
    pattern: '^v(?P<version>\d+\.\d+\.\d+)$'
    extract: '$version'
  policy:
    semver:
      range: '>=0.0.0'
```

- [ ] **Step 4: Rewrite `image-automation.yaml`**

```yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageUpdateAutomation
metadata:
  name: pennyworth
  namespace: flux-system
spec:
  interval: 30m
  sourceRef:
    kind: GitRepository
    name: monorepo
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        email: panicboat@gmail.com
        name: panicboat
      messageTemplate: |
        chore(pennyworth): bump image to {{range .Changed.Changes}}{{ println .NewValue }}{{end}}
    push:
      branch: main
  update:
    path: ./system-components/pennyworth/kubernetes/overlays/production
    strategy: Setters
```

- [ ] **Step 5: Rewrite `service.yaml`**

Despite the filename, this is a Flux `Kustomization` custom resource (unrelated to a Kubernetes `Service`) that applies `system-components/pennyworth/kubernetes/overlays/production` as one unit:

```yaml
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: pennyworth
  namespace: flux-system
spec:
  interval: 5m0s
  path: "./system-components/pennyworth/kubernetes/overlays/production"
  prune: true
  sourceRef:
    kind: GitRepository
    name: monorepo
  targetNamespace: system-components
  postBuild:
    substitute:
      service_name: pennyworth
```

- [ ] **Step 6: Verify `kustomization.yaml` needs no changes, then validate**

Read `clusters/production/system-components/pennyworth/kustomization.yaml` — it lists `service.yaml`, `image-repository.yaml`, `image-policy.yaml`, `image-automation.yaml` by filename only, none of which changed name in this task. No edit needed.

```bash
kubectl kustomize clusters/production/system-components/pennyworth
```

Expected: succeeds, all four resources render with `pennyworth` names and the `flux-system` namespace.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -s -m "refactor(system-components/holmes): rename Flux resources to pennyworth"
```

---

### Task 5: Update Terraform module and Terragrunt config

**Files:**
- Modify: `system-components/pennyworth/infrastructure/aws/modules/main.tf`
- Modify: `system-components/pennyworth/infrastructure/aws/modules/outputs.tf`
- Modify: `system-components/pennyworth/infrastructure/aws/production/env.hcl`
- Modify: `system-components/pennyworth/infrastructure/aws/production/terragrunt.hcl`

**Interfaces:**
- Consumes: nothing from earlier tasks (Terraform is independent of the Go/K8s changes)
- Produces: `aws_secretsmanager_secret.pennyworth_slack` at path `system-components/pennyworth/slack` (the path Task 3's ExternalSecret references). No Terraform-managed Alertmanager secret — Task 3's ExternalSecret reads the pre-existing `eks/holmesgpt/alertmanager` directly.

Run Steps 1-5 from `system-components/pennyworth/` (`cd system-components/pennyworth` first if starting a fresh shell). Step 6 changes into `infrastructure/aws/production` from there — see that step.

- [ ] **Step 1: Rewrite `infrastructure/aws/modules/main.tf`**

This deletes the orphaned `holmes_alertmanager` secret resource entirely (per the spec's Verified Findings — it was never referenced by any ExternalSecret, and the real value lives at `eks/holmesgpt/alertmanager`, shared with `panicboat/platform`):

```hcl
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
```

- [ ] **Step 2: Rewrite `infrastructure/aws/modules/outputs.tf`**

Removes `alertmanager_secret_arn` (its resource no longer exists) and updates `slack_secret_arn`'s reference:

```hcl
output "slack_secret_arn" {
  value       = aws_secretsmanager_secret.pennyworth_slack.arn
  description = "AWS Secrets Manager secret ARN for Slack credentials"
}
```

- [ ] **Step 3: Check `infrastructure/aws/modules/variables.tf` for any `holmes` references**

```bash
grep -n "holmes" infrastructure/aws/modules/variables.tf
```

Expected: no output (this file declares `environment`, `aws_region`, `common_tags` — none holmes-specific). If it does match, update it to match; if not, no edit needed.

- [ ] **Step 4: Rewrite `infrastructure/aws/production/env.hcl`**

```hcl
locals {
  environment = "production"
  aws_region  = "ap-northeast-1"
  additional_tags = {
    CostCenter = "production"
    Owner      = "panicboat"
    Purpose    = "pennyworth"
  }
}
```

- [ ] **Step 5: Update the state key in `infrastructure/aws/production/terragrunt.hcl`**

Change only the `key` line inside `remote_state.config`:

```
    key            = "system-components/holmes/${include.env.locals.environment}/terraform.tfstate"
```

to:

```
    key            = "system-components/pennyworth/${include.env.locals.environment}/terraform.tfstate"
```

Leave every other line in the file unchanged.

- [ ] **Step 6: Validate**

From `system-components/pennyworth/`:

```bash
cd infrastructure/aws/production
terragrunt validate
```

Expected: PASS (`Success! The configuration is valid.`). This does not require AWS credentials for a syntax/reference validation, but if credentials are configured in this environment, running `terragrunt plan` instead is a stronger check — expect it to show creating `aws_secretsmanager_secret.pennyworth_slack` and destroying/recreating nothing else (no prior state exists per the spec's Verified Findings, so this is a fresh plan, not a diff against a live resource).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -s -m "refactor(system-components/holmes): rename Terraform resources to pennyworth and drop the orphaned Alertmanager secret"
```

---

### Task 6: Update release-please config and manifest

**Files:**
- Modify: `.github/release-please-config.json`
- Modify: `.github/release-please-manifest.json`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: release-please tracks `system-components/pennyworth` as component `pennyworth` starting at version `0.0.0` — the first release tag will be `pennyworth-v0.1.0` (or whatever release-please computes from the first conventional commit).

Run all commands and file edits in this task from the worktree root (`.github/` is at the monorepo root, not inside `system-components/pennyworth/`).

- [ ] **Step 1: Update `.github/release-please-config.json`**

Find the `"system-components/holmes"` entry under `"packages"` and change both the key and its `component` value:

```json
    "system-components/pennyworth": {
      "release-type": "simple",
      "component": "pennyworth",
      "include-component-in-tag": true
    },
```

(Keep the same `release-type`/`include-component-in-tag` values the `holmes` entry had — only the key and `component` change.)

- [ ] **Step 2: Update `.github/release-please-manifest.json`**

Remove the `"system-components/holmes": "0.6.1"` entry and add:

```json
    "system-components/pennyworth": "0.0.0",
```

- [ ] **Step 3: Validate JSON syntax**

```bash
python3 -c "import json; json.load(open('.github/release-please-config.json')); json.load(open('.github/release-please-manifest.json')); print('valid')"
```

Expected: `valid` (no exception).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -m "chore(system-components/holmes): register pennyworth in release-please"
```

---

### Task 7: Rewrite README.md

**Files:**
- Modify: `system-components/pennyworth/README.md`

**Interfaces:**
- Consumes: every prior task's final identifiers (this task must reflect the finished state — run it last)
- Produces: nothing consumed by later tasks (last task in the plan)

Run all commands and file edits in this task from `system-components/pennyworth/` (`cd system-components/pennyworth` first if starting a fresh shell).

- [ ] **Step 1: Rewrite `README.md`**

```markdown
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
```

- [ ] **Step 2: Confirm the rewritten README carries no stale reference**

Run from `system-components/pennyworth/`:

```bash
grep -n "docs/superpowers/plans/2026-08-14-holmes-relay-alertmanager-route" README.md
```

Expected: no output (the new README does not reference that old plan file — it described the pre-rename `holmes-relay` hostname, which is now doubly stale, and Section 3 above stands on its own without it).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -m "docs(system-components/holmes): rewrite README for pennyworth"
```

---

## Final Verification

- [ ] Run: `cd system-components/pennyworth && go build ./... && go vet ./... && go test ./... -v -race -count=1` — expect all PASS.
- [ ] Run: `grep -rln "holmes" system-components/pennyworth --include="*.go" --include="*.yaml" --include="*.tf" --include="*.hcl" --include="*.md" -i` — expect matches ONLY in: comments/strings that correctly refer to HolmesGPT itself (e.g. `internal/clients/holmesgpt`, `HOLMESGPT_*`, `holmesgpt-holmes.holmesgpt.svc.cluster.local`, `eks/holmesgpt/alertmanager`, `github-app/holmesgpt-bot`, `panicboat-holmesgpt-bot`, the Design doc filename reference). Anything referring to the service itself as `holmes` (not `holmesgpt`) is a leftover to fix.
- [ ] Run: `kubectl kustomize system-components/pennyworth/kubernetes/base && kubectl kustomize system-components/pennyworth/kubernetes/overlays/production && kubectl kustomize clusters/production/system-components/pennyworth` — expect all three to succeed with no errors.
- [ ] Confirm `system-components/holmes/` and `clusters/production/system-components/holmes/` no longer exist (`git status` should show them as renames, not stray leftovers).
- [ ] Confirm no files outside this monorepo were touched (this plan's Global Constraints forbid touching `panicboat/platform`).
