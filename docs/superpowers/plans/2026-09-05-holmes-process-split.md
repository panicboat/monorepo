# Holmes Process Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split holmes into two independently deployable processes — a Slack mention handler (with GitHub write access) and an Alertmanager notification relay — while keeping them in one Go module and one container image.

**Architecture:** `main.go` splits into `cmd/slack/main.go` and `cmd/alertmanager/main.go`, both importing the existing `internal/config` and `internal/clients/*` packages unchanged. The Dockerfile builds both binaries into one image; Kubernetes Deployments pick which binary to run via `command`. Kubernetes manifests split into `holmes-slack` and `holmes-alertmanager` Deployment/Service pairs behind the existing single Ingress, routed by path, so the GitHub App secret only reaches the Slack process.

**Tech Stack:** Go 1.24 (stdlib `net/http` only, no framework), Docker multi-stage build, Kubernetes/Kustomize, Flux (unchanged, verified to need no edits).

**Spec:** `docs/superpowers/specs/2026-09-05-holmes-action-architecture-design.md`, section "1. Process split — 1 image, 2 Deployments, command で分岐"

## Global Constraints

- Go module path stays `github.com/panicboat/monorepo/system-components/holmes` — no go.mod split, no new module.
- Exactly one `Dockerfile` stays at `system-components/holmes/Dockerfile` — CI (`workflow-config.yaml` stack_conventions, `release-please` component `holmes`, `reusable--container-builder.yaml`) requires this and must not be touched.
- Flux (`clusters/production/system-components/holmes/*`) must not be touched — its Kustomization applies `kubernetes/overlays/production` as one unit and its `$imagepolicy: "flux-system:holmes"` Setters marker works across multiple files.
- The GitHub App secret (`holmes-github`) must only be mounted on the Slack Deployment, never the Alertmanager Deployment.
- External URLs must not change: Slack Event Subscriptions request URL keeps working at `/slack/events`, Alertmanager webhook keeps working at `/alertmanager/webhook`, hostname stays `holmes.panicboat.net`.

---

## File Structure

- Modify: `system-components/holmes/internal/config/config.go` — replace `Load` with `LoadSlack` and `LoadAlertmanager`
- Modify: `system-components/holmes/internal/config/config_test.go` — replace `TestLoad_*` with `TestLoadSlack_*` / `TestLoadAlertmanager_*`
- Create: `system-components/holmes/cmd/slack/main.go`
- Create: `system-components/holmes/cmd/alertmanager/main.go`
- Delete: `system-components/holmes/main.go`
- Modify: `system-components/holmes/Dockerfile`
- Delete: `system-components/holmes/kubernetes/base/deployment.yaml`
- Create: `system-components/holmes/kubernetes/base/deployment-slack.yaml`
- Create: `system-components/holmes/kubernetes/base/deployment-alertmanager.yaml`
- Delete: `system-components/holmes/kubernetes/base/service.yaml`
- Create: `system-components/holmes/kubernetes/base/service-slack.yaml`
- Create: `system-components/holmes/kubernetes/base/service-alertmanager.yaml`
- Modify: `system-components/holmes/kubernetes/base/kustomization.yaml`
- Modify: `system-components/holmes/kubernetes/base/ingress.yaml`
- Modify: `system-components/holmes/kubernetes/overlays/production/deployment.yaml`
- Modify: `system-components/holmes/kubernetes/overlays/production/kustomization.yaml`

---

### Task 1: Split `config.Load` into `LoadSlack` and `LoadAlertmanager`

**Files:**
- Modify: `system-components/holmes/internal/config/config.go`
- Modify: `system-components/holmes/internal/config/config_test.go`

**Interfaces:**
- Consumes: nothing (leaf package)
- Produces: `config.LoadSlack() (config.Config, error)` — validates `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `HOLMES_API_URL`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`. `config.LoadAlertmanager() (config.Config, error)` — validates `ALERTMANAGER_SHARED_TOKEN`, `SLACK_BOT_TOKEN`, `HOLMES_API_URL`. Both return the same `config.Config` struct (unchanged fields) and default `HolmesModel` to `"sonnet-4-6"` when `HOLMES_MODEL` is unset. Task 2 depends on these two functions.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `system-components/holmes/internal/config/config_test.go`:

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
	setEnv(t, "HOLMES_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	setEnv(t, "GITHUB_APP_ID", "123")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")
	unsetEnv(t, "HOLMES_MODEL")
	unsetEnv(t, "ALERTMANAGER_SHARED_TOKEN")

	cfg, err := LoadSlack()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HolmesModel != "sonnet-4-6" {
		t.Errorf("expected default model sonnet-4-6, got %q", cfg.HolmesModel)
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
	setEnv(t, "HOLMES_API_URL", "http://example.invalid")
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
	setEnv(t, "HOLMES_API_URL", "http://example.invalid")
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
	setEnv(t, "HOLMES_API_URL", "http://example.invalid")
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
	setEnv(t, "HOLMES_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	unsetEnv(t, "HOLMES_MODEL")
	unsetEnv(t, "SLACK_SIGNING_SECRET")
	unsetEnv(t, "GITHUB_APP_ID")

	cfg, err := LoadAlertmanager()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HolmesModel != "sonnet-4-6" {
		t.Errorf("expected default model sonnet-4-6, got %q", cfg.HolmesModel)
	}
	if cfg.AlertmanagerToken != "am-token" {
		t.Errorf("expected AlertmanagerToken %q, got %q", "am-token", cfg.AlertmanagerToken)
	}
}

func TestLoadAlertmanager_MissingToken(t *testing.T) {
	unsetEnv(t, "ALERTMANAGER_SHARED_TOKEN")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMES_API_URL", "http://example.invalid")

	if _, err := LoadAlertmanager(); err == nil {
		t.Fatal("expected error when ALERTMANAGER_SHARED_TOKEN is missing, got nil")
	}
}

func TestLoadAlertmanager_DoesNotRequireGitHubApp(t *testing.T) {
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMES_API_URL", "http://example.invalid")
	unsetEnv(t, "GITHUB_APP_ID")
	unsetEnv(t, "GITHUB_APP_PRIVATE_KEY")
	unsetEnv(t, "GITHUB_APP_INSTALLATION_ID")
	unsetEnv(t, "SLACK_SIGNING_SECRET")

	if _, err := LoadAlertmanager(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd system-components/holmes && go test ./internal/config/... -v`
Expected: FAIL to compile — `undefined: LoadSlack`, `undefined: LoadAlertmanager` (the old `Load` function and its tests no longer exist in the test file, so the package won't build until `config.go` is updated).

- [ ] **Step 3: Replace `config.go` with the split loaders**

Replace the full contents of `system-components/holmes/internal/config/config.go`:

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
	HolmesAPIURL            string
	HolmesModel             string
	GitHubAppID             string
	GitHubAppPrivateKey     string
	GitHubAppInstallationID string
}

func fromEnv() Config {
	cfg := Config{
		SlackSigningSecret:      os.Getenv("SLACK_SIGNING_SECRET"),
		SlackBotToken:           os.Getenv("SLACK_BOT_TOKEN"),
		AlertmanagerToken:       os.Getenv("ALERTMANAGER_SHARED_TOKEN"),
		HolmesAPIURL:            os.Getenv("HOLMES_API_URL"),
		HolmesModel:             os.Getenv("HOLMES_MODEL"),
		GitHubAppID:             os.Getenv("GITHUB_APP_ID"),
		GitHubAppPrivateKey:     os.Getenv("GITHUB_APP_PRIVATE_KEY"),
		GitHubAppInstallationID: os.Getenv("GITHUB_APP_INSTALLATION_ID"),
	}
	if cfg.HolmesModel == "" {
		cfg.HolmesModel = "sonnet-4-6"
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
	if cfg.HolmesAPIURL == "" {
		return cfg, fmt.Errorf("HOLMES_API_URL is required")
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
	if cfg.HolmesAPIURL == "" {
		return cfg, fmt.Errorf("HOLMES_API_URL is required")
	}
	return cfg, nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd system-components/holmes && go test ./internal/config/... -v`
Expected: PASS (all `TestLoadSlack_*` and `TestLoadAlertmanager_*` tests green)

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/internal/config/config.go system-components/holmes/internal/config/config_test.go
git commit -s -m "refactor(system-components/holmes): split config.Load into LoadSlack/LoadAlertmanager"
```

---

### Task 2: Split `main.go` into `cmd/slack` and `cmd/alertmanager`

**Files:**
- Create: `system-components/holmes/cmd/slack/main.go`
- Create: `system-components/holmes/cmd/alertmanager/main.go`
- Delete: `system-components/holmes/main.go`

**Interfaces:**
- Consumes: `config.LoadSlack`, `config.LoadAlertmanager` (Task 1); `holmes.New(baseURL, model string) *holmes.Client` (`internal/clients/holmes`, unchanged); `slack.New(botToken string) *slack.Client` (`internal/clients/slack`, unchanged); `github.New(appID, privateKeyPEM, installationID string) (*github.Client, error)` (`internal/clients/github`, unchanged); `slackhandler.Handler{Cfg, Holmes, Client, GitHub}` (`internal/handlers/slack`, unchanged); `alertmanager.Handler{Cfg, Holmes, Client}` (`internal/handlers/alertmanager`, unchanged)
- Produces: two binaries. `holmes-slack` serves `/healthz` and `/slack/events` on `:8080`. `holmes-alertmanager` serves `/healthz` and `/alertmanager/webhook` on `:8080`. Task 3 (Dockerfile) builds both.

- [ ] **Step 1: Create `cmd/slack/main.go`**

```go
package main

import (
	"log"
	"net/http"

	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/github"
	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/holmes"
	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
	slackhandler "github.com/panicboat/monorepo/system-components/holmes/internal/handlers/slack"
)

func main() {
	cfg, err := config.LoadSlack()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	holmesClient := holmes.New(cfg.HolmesAPIURL, cfg.HolmesModel)
	slackClient := slack.New(cfg.SlackBotToken)
	githubClient, err := github.New(cfg.GitHubAppID, cfg.GitHubAppPrivateKey, cfg.GitHubAppInstallationID)
	if err != nil {
		log.Fatalf("github client error: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/slack/events", &slackhandler.Handler{Cfg: cfg, Holmes: holmesClient, Client: slackClient, GitHub: githubClient})

	addr := ":8080"
	log.Printf("holmes-slack listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 2: Create `cmd/alertmanager/main.go`**

```go
package main

import (
	"log"
	"net/http"

	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/holmes"
	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
	"github.com/panicboat/monorepo/system-components/holmes/internal/handlers/alertmanager"
)

func main() {
	cfg, err := config.LoadAlertmanager()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	holmesClient := holmes.New(cfg.HolmesAPIURL, cfg.HolmesModel)
	slackClient := slack.New(cfg.SlackBotToken)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/alertmanager/webhook", &alertmanager.Handler{Cfg: cfg, Holmes: holmesClient, Client: slackClient})

	addr := ":8080"
	log.Printf("holmes-alertmanager listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 3: Delete the old `main.go`**

```bash
git rm system-components/holmes/main.go
```

- [ ] **Step 4: Build and test everything**

Run: `cd system-components/holmes && go build ./... && go vet ./... && go test ./... -v -race -count=1`
Expected: build succeeds for both `cmd/slack` and `cmd/alertmanager`, `go vet` reports nothing, all existing handler/client tests still PASS (they're unaffected — `internal/handlers/*` and `internal/clients/*` didn't change).

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/cmd system-components/holmes/main.go
git commit -s -m "refactor(system-components/holmes): split main.go into cmd/slack and cmd/alertmanager"
```

---

### Task 3: Build both binaries into one Docker image

**Files:**
- Modify: `system-components/holmes/Dockerfile`

**Interfaces:**
- Consumes: `cmd/slack`, `cmd/alertmanager` (Task 2)
- Produces: one image containing `/holmes-slack` and `/holmes-alertmanager` executables. Task 4/6 (Kubernetes manifests) reference this image and override `command` per Deployment.

- [ ] **Step 1: Rewrite the Dockerfile**

Replace the full contents of `system-components/holmes/Dockerfile`:

```dockerfile
FROM golang:1.24.13-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/holmes-slack ./cmd/slack
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/holmes-alertmanager ./cmd/alertmanager

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/holmes-slack /holmes-slack
COPY --from=builder /out/holmes-alertmanager /holmes-alertmanager
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/holmes-slack"]
```

- [ ] **Step 2: Build the image locally**

Run: `cd system-components/holmes && docker build -t holmes-test:local .`
Expected: build succeeds (two `RUN go build` steps, then a distroless final stage).

- [ ] **Step 3: Verify both binaries are present and runnable**

Run: `docker run --rm --entrypoint /holmes-slack holmes-test:local`
Expected: exits non-zero and logs a config error mentioning `SLACK_SIGNING_SECRET is required` (proves the `holmes-slack` binary exists, is executable, and reaches `config.LoadSlack`).

Run: `docker run --rm --entrypoint /holmes-alertmanager holmes-test:local`
Expected: exits non-zero and logs a config error mentioning `ALERTMANAGER_SHARED_TOKEN is required` (proves the `holmes-alertmanager` binary exists, is executable, and reaches `config.LoadAlertmanager`).

- [ ] **Step 4: Clean up the local test image**

Run: `docker rmi holmes-test:local`

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/Dockerfile
git commit -s -m "build(system-components/holmes): produce both binaries in one image"
```

---

### Task 4: Split base Deployment and Service into slack/alertmanager pairs

**Files:**
- Delete: `system-components/holmes/kubernetes/base/deployment.yaml`
- Create: `system-components/holmes/kubernetes/base/deployment-slack.yaml`
- Create: `system-components/holmes/kubernetes/base/deployment-alertmanager.yaml`
- Delete: `system-components/holmes/kubernetes/base/service.yaml`
- Create: `system-components/holmes/kubernetes/base/service-slack.yaml`
- Create: `system-components/holmes/kubernetes/base/service-alertmanager.yaml`
- Modify: `system-components/holmes/kubernetes/base/kustomization.yaml`

**Interfaces:**
- Consumes: Task 3's image (referenced by tag, unchanged repo name `ghcr.io/panicboat/monorepo/holmes`)
- Produces: `Deployment/holmes-slack` (label `app: holmes-slack`, container `command: ["/holmes-slack"]`, envFrom `holmes` ConfigMap + `holmes-slack` + `holmes-github` Secrets), `Deployment/holmes-alertmanager` (label `app: holmes-alertmanager`, container `command: ["/holmes-alertmanager"]`, envFrom `holmes` ConfigMap + `holmes-slack` + `holmes-alertmanager` Secrets — no `holmes-github`), and matching `Service/holmes-slack` / `Service/holmes-alertmanager`. Task 5 (Ingress) and Task 6 (overlay patch) depend on these exact names.

- [ ] **Step 1: Remove the combined Deployment and Service**

```bash
git rm system-components/holmes/kubernetes/base/deployment.yaml system-components/holmes/kubernetes/base/service.yaml
```

- [ ] **Step 2: Create `deployment-slack.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: holmes-slack
  annotations:
    reloader.stakater.com/auto: "true"
spec:
  replicas: 1
  revisionHistoryLimit: 1
  selector:
    matchLabels:
      app: holmes-slack
  template:
    metadata:
      labels:
        app: holmes-slack
    spec:
      containers:
        - name: holmes-slack
          image: ghcr.io/panicboat/monorepo/holmes:latest
          imagePullPolicy: IfNotPresent
          command: ["/holmes-slack"]
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: holmes
            - secretRef:
                name: holmes-slack
            - secretRef:
                name: holmes-github
```

- [ ] **Step 3: Create `deployment-alertmanager.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: holmes-alertmanager
  annotations:
    reloader.stakater.com/auto: "true"
spec:
  replicas: 1
  revisionHistoryLimit: 1
  selector:
    matchLabels:
      app: holmes-alertmanager
  template:
    metadata:
      labels:
        app: holmes-alertmanager
    spec:
      containers:
        - name: holmes-alertmanager
          image: ghcr.io/panicboat/monorepo/holmes:latest
          imagePullPolicy: IfNotPresent
          command: ["/holmes-alertmanager"]
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

- [ ] **Step 4: Create `service-slack.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: holmes-slack
spec:
  selector:
    app: holmes-slack
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

- [ ] **Step 5: Create `service-alertmanager.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: holmes-alertmanager
spec:
  selector:
    app: holmes-alertmanager
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

- [ ] **Step 6: Update `kustomization.yaml`**

Replace the full contents of `system-components/holmes/kubernetes/base/kustomization.yaml`. Note the top-level `labels: app: holmes` is removed — it would stamp `app: holmes` onto every resource on top of the per-Deployment `app: holmes-slack` / `app: holmes-alertmanager` labels already set, breaking each Service's `selector` match (Kustomize's top-level `labels` merges into `spec.selector.matchLabels` too):

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - configmap.yaml
  - deployment-slack.yaml
  - deployment-alertmanager.yaml
  - ingress.yaml
  - service-slack.yaml
  - service-alertmanager.yaml
```

- [ ] **Step 7: Verify with kustomize build**

Run: `kubectl kustomize system-components/holmes/kubernetes/base`
Expected: succeeds, output contains `kind: Deployment` twice (names `holmes-slack`, `holmes-alertmanager`) and `kind: Service` twice (same names), each Service's `spec.selector.app` matching its Deployment's `spec.template.metadata.labels.app`.

- [ ] **Step 8: Commit**

```bash
git add system-components/holmes/kubernetes/base
git commit -s -m "refactor(system-components/holmes): split base Deployment/Service into slack/alertmanager pairs"
```

---

### Task 5: Route the Ingress by path to each Service

**Files:**
- Modify: `system-components/holmes/kubernetes/base/ingress.yaml`

**Interfaces:**
- Consumes: `Service/holmes-slack`, `Service/holmes-alertmanager` (Task 4)
- Produces: `holmes.panicboat.net/slack/events` → `holmes-slack`, `holmes.panicboat.net/alertmanager/webhook` → `holmes-alertmanager`. External URLs unchanged from the caller's perspective (Slack Event Subscriptions, Alertmanager webhook_configs keep working without reconfiguration).

- [ ] **Step 1: Rewrite `ingress.yaml`**

Replace the full contents of `system-components/holmes/kubernetes/base/ingress.yaml`:

```yaml
# holmes takes direct POSTs from Slack and Alertmanager, so unlike the
# oauth2-proxy-fronted monitoring-uis Ingresses it has no auth in front.
# Uses the panicboat.net private-tooling zone, kept separate from the
# public product's dystopia.city / cilium Gateway API path
# (frontend/monolith, still incomplete). Shares the ALB with platform's
# kubernetes/components/cilium application Ingress via group.name:
# application.
#
# healthcheck-path is an Ingress-level annotation applied to every
# target group in this Ingress (both holmes-slack and
# holmes-alertmanager), so one /healthz setting covers both Services —
# both binaries implement that path.
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: holmes
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/group.name: application
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /healthz
    alb.ingress.kubernetes.io/healthcheck-port: traffic-port
    alb.ingress.kubernetes.io/ssl-policy: ELBSecurityPolicy-TLS13-1-2-2021-06
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    external-dns.alpha.kubernetes.io/hostname: holmes.panicboat.net
spec:
  ingressClassName: alb
  rules:
    - host: holmes.panicboat.net
      http:
        paths:
          - path: /slack
            pathType: Prefix
            backend:
              service:
                name: holmes-slack
                port:
                  number: 80
          - path: /alertmanager
            pathType: Prefix
            backend:
              service:
                name: holmes-alertmanager
                port:
                  number: 80
```

- [ ] **Step 2: Verify with kustomize build**

Run: `kubectl kustomize system-components/holmes/kubernetes/base`
Expected: succeeds, the single `kind: Ingress` has two path rules under `host: holmes.panicboat.net`, `/slack` → `holmes-slack`, `/alertmanager` → `holmes-alertmanager`.

- [ ] **Step 3: Commit**

```bash
git add system-components/holmes/kubernetes/base/ingress.yaml
git commit -s -m "refactor(system-components/holmes): route Ingress by path to slack/alertmanager Services"
```

---

### Task 6: Update the production overlay's image patch for both Deployments

**Files:**
- Modify: `system-components/holmes/kubernetes/overlays/production/deployment.yaml`
- Modify: `system-components/holmes/kubernetes/overlays/production/kustomization.yaml`

**Interfaces:**
- Consumes: `Deployment/holmes-slack`, `Deployment/holmes-alertmanager` (Task 4)
- Produces: the production overlay's Flux-managed image tag patch applies to both Deployments. Nothing downstream in this plan depends on this — it's the final task.

- [ ] **Step 1: Rewrite `deployment.yaml` as a two-document patch**

Replace the full contents of `system-components/holmes/kubernetes/overlays/production/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: holmes-slack
spec:
  template:
    spec:
      containers:
        - name: holmes-slack
          image: ghcr.io/panicboat/monorepo/holmes:v0.6.0 # {"$imagepolicy": "flux-system:holmes"}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: holmes-alertmanager
spec:
  template:
    spec:
      containers:
        - name: holmes-alertmanager
          image: ghcr.io/panicboat/monorepo/holmes:v0.6.0 # {"$imagepolicy": "flux-system:holmes"}
```

- [ ] **Step 2: Confirm `kustomization.yaml` still applies the patch file as-is**

Read `system-components/holmes/kubernetes/overlays/production/kustomization.yaml` — it already references `deployment.yaml` as a single strategic-merge patch path (`patches: - path: deployment.yaml`), and Kustomize applies each YAML document in a patch file to the resource matching its own `kind`+`metadata.name`, so both documents apply correctly with no changes needed to this file. No edit required.

- [ ] **Step 3: Verify with kustomize build**

Run: `kubectl kustomize system-components/holmes/kubernetes/overlays/production`
Expected: succeeds, both `Deployment/holmes-slack` and `Deployment/holmes-alertmanager` show `image: ghcr.io/panicboat/monorepo/holmes:v0.6.0` with the `$imagepolicy` comment preserved, `Deployment/holmes-slack` includes the `holmes-github` secretRef and `Deployment/holmes-alertmanager` does not.

- [ ] **Step 4: Commit**

```bash
git add system-components/holmes/kubernetes/overlays/production/deployment.yaml
git commit -s -m "refactor(system-components/holmes): patch image tag on both slack/alertmanager Deployments"
```

---

## Final Verification

- [ ] Run: `cd system-components/holmes && go build ./... && go vet ./... && go test ./... -v -race -count=1` — expect all PASS.
- [ ] Run: `kubectl kustomize system-components/holmes/kubernetes/overlays/production` — expect no errors, two Deployments, two Services, one Ingress with two path rules.
- [ ] Confirm no files outside `system-components/holmes/` were touched (this plan makes no CI or Flux changes, per Global Constraints).
