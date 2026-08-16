# holmes GitHub Issue Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user ask holmes, in natural language inside a Slack thread, to create a GitHub issue from an investigation — HolmesGPT decides intent and target repo, holmes creates the issue via a dedicated GitHub App.

**Architecture:** HolmesGPT gains a second `additional_system_prompt` variant (sent only on the Slack-mention path, via a new `Chat` method) that asks it to detect issue-creation intent and, when detected, respond with a single JSON envelope instead of free text. holmes's Slack handler tries to parse every `Chat` response as that envelope; on parse failure it falls through to today's unchanged behavior (post the text as-is). On a successful parse, holmes either asks the user to confirm an inferred repo, or calls a new GitHub App client to create the issue and posts the resulting URL. The Alertmanager flow is untouched — it keeps using `Investigate`, which never receives the issue-detection instructions.

**Tech Stack:** Go 1.24 (stdlib only — see Global Constraints), Kustomize, External Secrets.

## Global Constraints

- **No third-party Go dependencies.** `system-components/holmes/workspace/go.mod` currently has zero `require` entries — every existing client is stdlib-only. The GitHub App JWT (RS256) must be implemented with `crypto/rsa`, `crypto/x509`, `crypto/sha256`, `encoding/pem`, `encoding/base64` — do not add a JWT library.
- Code elements (names, comments, commit messages) in English.
- `git commit -s`, no `Co-Authored-By`.
- JSON envelope field names are exact, from the design spec: `action`, `repo`, `title`, `body`, `ready`, `reason`. `action` is always the literal string `"create_issue"` when the envelope is used.
- `Chat` (new) is used only by `internal/handlers/slack`. `Investigate` (existing) is used only by `internal/handlers/alertmanager` and must not change — its `additional_system_prompt` must never include the issue-detection instructions, so an alert investigation can never receive or need to parse a `create_issue` envelope.
- GitHub REST calls use `Authorization: Bearer <token>` (both the App-level JWT and the installation access token) and `Accept: application/vnd.github+json`.
- Kubernetes: wire new config via `envFrom: secretRef` (matching the existing `holmes-slack`/`holmes-alertmanager` pattern in `system-components/holmes/kubernetes/base/deployment.yaml`) — not individual `env:` entries.
- Design doc: `docs/superpowers/specs/2026-08-17-holmes-github-issue-design.md` (panicboat/platform repo).

---

## Task 1: GitHub App client (`internal/clients/github`)

**Files:**
- Create: `system-components/holmes/workspace/internal/clients/github/client.go`
- Create: `system-components/holmes/workspace/internal/clients/github/client_test.go`

**Interfaces:**
- Produces: `github.New(appID, privateKeyPEM, installationID string) (*github.Client, error)` and `(*github.Client) CreateIssue(repo, title, body string) (string, error)` — the exact signature Task 4 wires into the Slack handler.

- [ ] **Step 1: Write the failing tests**

```go
package github

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"testing"
)

func testPrivateKeyPEM(t *testing.T) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate test key: %v", err)
	}
	block := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}
	return string(pem.EncodeToMemory(block))
}

func TestNew_InvalidPrivateKey(t *testing.T) {
	if _, err := New("1", "not a pem block", "2"); err == nil {
		t.Fatal("expected error for invalid private key, got nil")
	}
}

func TestClient_CreateIssue_Success(t *testing.T) {
	var tokenRequests int
	var gotJWTAuth, gotInstallationAuth string
	var gotIssueBody map[string]string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/app/installations/999/access_tokens":
			tokenRequests++
			gotJWTAuth = r.Header.Get("Authorization")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{
				"token":      "installation-token",
				"expires_at": "2099-01-01T00:00:00Z",
			})
		case r.Method == http.MethodPost && r.URL.Path == "/repos/panicboat/monorepo/issues":
			gotInstallationAuth = r.Header.Get("Authorization")
			json.NewDecoder(r.Body).Decode(&gotIssueBody)
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{"html_url": "https://github.com/panicboat/monorepo/issues/1"})
		default:
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client, err := New("123", testPrivateKeyPEM(t), "999")
	if err != nil {
		t.Fatalf("unexpected error from New: %v", err)
	}
	client.BaseURL = server.URL

	url, err := client.CreateIssue("panicboat/monorepo", "found a bug", "details here")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url != "https://github.com/panicboat/monorepo/issues/1" {
		t.Errorf("got url %q, want %q", url, "https://github.com/panicboat/monorepo/issues/1")
	}
	if gotJWTAuth == "" || gotJWTAuth == "Bearer installation-token" {
		t.Errorf("expected the token-exchange request to carry the app JWT, got %q", gotJWTAuth)
	}
	if gotInstallationAuth != "Bearer installation-token" {
		t.Errorf("expected the issue-creation request to carry the installation token, got %q", gotInstallationAuth)
	}
	if gotIssueBody["title"] != "found a bug" || gotIssueBody["body"] != "details here" {
		t.Errorf("unexpected issue body sent: %+v", gotIssueBody)
	}
	if tokenRequests != 1 {
		t.Errorf("expected exactly 1 token-exchange request, got %d", tokenRequests)
	}
}

func TestClient_CreateIssue_TokenCachedAcrossCalls(t *testing.T) {
	var tokenRequests int

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/app/installations/999/access_tokens":
			tokenRequests++
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{
				"token":      "installation-token",
				"expires_at": "2099-01-01T00:00:00Z",
			})
		case r.URL.Path == "/repos/panicboat/monorepo/issues":
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{"html_url": "https://github.com/panicboat/monorepo/issues/1"})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client, err := New("123", testPrivateKeyPEM(t), "999")
	if err != nil {
		t.Fatalf("unexpected error from New: %v", err)
	}
	client.BaseURL = server.URL

	if _, err := client.CreateIssue("panicboat/monorepo", "t1", "b1"); err != nil {
		t.Fatalf("unexpected error on first call: %v", err)
	}
	if _, err := client.CreateIssue("panicboat/monorepo", "t2", "b2"); err != nil {
		t.Fatalf("unexpected error on second call: %v", err)
	}
	if tokenRequests != 1 {
		t.Errorf("expected the cached token to be reused, got %d token requests", tokenRequests)
	}
}

func TestClient_CreateIssue_GitHubError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/app/installations/999/access_tokens":
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{
				"token":      "installation-token",
				"expires_at": "2099-01-01T00:00:00Z",
			})
		case "/repos/panicboat/does-not-exist/issues":
			w.WriteHeader(http.StatusNotFound)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client, err := New("123", testPrivateKeyPEM(t), "999")
	if err != nil {
		t.Fatalf("unexpected error from New: %v", err)
	}
	client.BaseURL = server.URL

	if _, err := client.CreateIssue("panicboat/does-not-exist", "t", "b"); err == nil {
		t.Fatal("expected an error for a 404 response, got nil")
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/github/... -v`
Expected: FAIL (build failure — the `github` package doesn't exist yet).

- [ ] **Step 3: Implement the client**

```go
package github

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type Client struct {
	AppID          string
	PrivateKey     *rsa.PrivateKey
	InstallationID string
	BaseURL        string
	HTTPClient     *http.Client

	mu          sync.Mutex
	cachedToken string
	tokenExpiry time.Time
}

func New(appID, privateKeyPEM, installationID string) (*Client, error) {
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil {
		return nil, fmt.Errorf("decode private key: no PEM block found")
	}
	key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse private key: %w", err)
	}
	return &Client{
		AppID:          appID,
		PrivateKey:     key,
		InstallationID: installationID,
		BaseURL:        "https://api.github.com",
		HTTPClient:     &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func base64URLEncode(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}

// generateJWT builds a short-lived App-level JWT per GitHub's documented
// requirements: iat backdated 60s for clock drift tolerance, exp capped
// under GitHub's 10-minute maximum.
func (c *Client) generateJWT() (string, error) {
	now := time.Now()
	header := base64URLEncode([]byte(`{"alg":"RS256","typ":"JWT"}`))
	claims := base64URLEncode([]byte(fmt.Sprintf(
		`{"iat":%d,"exp":%d,"iss":"%s"}`,
		now.Add(-60*time.Second).Unix(),
		now.Add(9*time.Minute).Unix(),
		c.AppID,
	)))
	signingInput := header + "." + claims
	hash := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, c.PrivateKey, crypto.SHA256, hash[:])
	if err != nil {
		return "", fmt.Errorf("sign jwt: %w", err)
	}
	return signingInput + "." + base64URLEncode(sig), nil
}

type installationTokenResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// installationToken returns a cached installation access token, refreshing
// it (via a fresh App-level JWT) whenever the cached one is within a
// minute of expiring.
func (c *Client) installationToken() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.cachedToken != "" && time.Now().Before(c.tokenExpiry.Add(-1*time.Minute)) {
		return c.cachedToken, nil
	}

	jwt, err := c.generateJWT()
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/app/installations/%s/access_tokens", c.BaseURL, c.InstallationID)
	req, err := http.NewRequest(http.MethodPost, url, nil)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call github api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("github api returned status %d requesting installation token", resp.StatusCode)
	}

	var result installationTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	c.cachedToken = result.Token
	c.tokenExpiry = result.ExpiresAt
	return c.cachedToken, nil
}

type createIssueRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

type createIssueResponse struct {
	HTMLURL string `json:"html_url"`
}

func (c *Client) CreateIssue(repo, title, body string) (string, error) {
	token, err := c.installationToken()
	if err != nil {
		return "", fmt.Errorf("get installation token: %w", err)
	}

	reqBody, err := json.Marshal(createIssueRequest{Title: title, Body: body})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/repos/%s/issues", c.BaseURL, repo)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call github api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("github api returned status %d creating issue in %s", resp.StatusCode, repo)
	}

	var result createIssueResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	return result.HTMLURL, nil
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/github/... -v`
Expected: PASS — all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/workspace/internal/clients/github/
git commit -s -m "feat(holmes): add GitHub App client for issue creation"
```

---

## Task 2: Config fields for the GitHub App

**Files:**
- Modify: `system-components/holmes/workspace/internal/config/config.go`
- Modify: `system-components/holmes/workspace/internal/config/config_test.go`

**Interfaces:**
- Produces: `config.Config` gains `GitHubAppID`, `GitHubAppPrivateKey`, `GitHubAppInstallationID string` — the exact field names Task 4's `main.go` change reads to construct the GitHub client.

- [ ] **Step 1: Update the failing test**

In `system-components/holmes/workspace/internal/config/config_test.go`, find:

```go
func TestLoad_AllRequiredPresent(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "HOLMES_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	os.Unsetenv("HOLMES_MODEL")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HolmesModel != "sonnet-4-6" {
		t.Errorf("expected default model sonnet-4-6, got %q", cfg.HolmesModel)
	}
}
```

Replace with:

```go
func TestLoad_AllRequiredPresent(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "HOLMES_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	setEnv(t, "GITHUB_APP_ID", "123")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")
	os.Unsetenv("HOLMES_MODEL")

	cfg, err := Load()
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
```

`TestLoad_MissingRequired` needs no change: it unsets `SLACK_SIGNING_SECRET`, and `Load()` returns on that first missing-required check before ever reaching the new fields' checks.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd system-components/holmes/workspace && go test ./internal/config/... -v -run TestLoad_AllRequiredPresent$`
Expected: FAIL — `cfg.GitHubAppID` etc. don't exist yet (build failure).

- [ ] **Step 3: Add the fields and required checks**

In `system-components/holmes/workspace/internal/config/config.go`, find:

```go
type Config struct {
	SlackSigningSecret string
	SlackBotToken      string
	AlertmanagerToken  string
	HolmesAPIURL       string
	HolmesModel        string
}

func Load() (Config, error) {
	cfg := Config{
		SlackSigningSecret: os.Getenv("SLACK_SIGNING_SECRET"),
		SlackBotToken:      os.Getenv("SLACK_BOT_TOKEN"),
		AlertmanagerToken:  os.Getenv("ALERTMANAGER_SHARED_TOKEN"),
		HolmesAPIURL:       os.Getenv("HOLMES_API_URL"),
		HolmesModel:        os.Getenv("HOLMES_MODEL"),
	}
	if cfg.SlackSigningSecret == "" {
		return cfg, fmt.Errorf("SLACK_SIGNING_SECRET is required")
	}
	if cfg.SlackBotToken == "" {
		return cfg, fmt.Errorf("SLACK_BOT_TOKEN is required")
	}
	if cfg.AlertmanagerToken == "" {
		return cfg, fmt.Errorf("ALERTMANAGER_SHARED_TOKEN is required")
	}
	if cfg.HolmesAPIURL == "" {
		return cfg, fmt.Errorf("HOLMES_API_URL is required")
	}
	if cfg.HolmesModel == "" {
		cfg.HolmesModel = "sonnet-4-6"
	}
	return cfg, nil
}
```

Replace with:

```go
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

func Load() (Config, error) {
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
	if cfg.SlackSigningSecret == "" {
		return cfg, fmt.Errorf("SLACK_SIGNING_SECRET is required")
	}
	if cfg.SlackBotToken == "" {
		return cfg, fmt.Errorf("SLACK_BOT_TOKEN is required")
	}
	if cfg.AlertmanagerToken == "" {
		return cfg, fmt.Errorf("ALERTMANAGER_SHARED_TOKEN is required")
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
	if cfg.HolmesModel == "" {
		cfg.HolmesModel = "sonnet-4-6"
	}
	return cfg, nil
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd system-components/holmes/workspace && go test ./internal/config/... -v`
Expected: PASS — both tests.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/workspace/internal/config/
git commit -s -m "feat(holmes): add GitHub App config fields"
```

---

## Task 3: `Chat` method on the HolmesGPT client

**Files:**
- Modify: `system-components/holmes/workspace/internal/clients/holmes/client.go`
- Modify: `system-components/holmes/workspace/internal/clients/holmes/client_test.go`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: `(*holmes.Client) Chat(ask string) (string, error)` — the exact method Task 4's Slack handler calls. `Investigate` keeps its existing signature and behavior unchanged (Task 4 does not touch the Alertmanager handler).

- [ ] **Step 1: Write the failing tests**

In `system-components/holmes/workspace/internal/clients/holmes/client_test.go`, add (after the existing `TestClient_Investigate` function, before `TestClient_Investigate_ErrorStatus`):

```go
func TestClient_Investigate_NoIssueInstructions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req holmesChatRequest
		json.NewDecoder(r.Body).Decode(&req)
		if strings.Contains(req.AdditionalSystemPrompt, "create_issue") {
			t.Errorf("Investigate must never send issue-detection instructions, got: %q", req.AdditionalSystemPrompt)
		}
		json.NewEncoder(w).Encode(holmesChatResponse{Analysis: "ok"})
	}))
	defer server.Close()

	client := New(server.URL, "sonnet-4-6")
	if _, err := client.Investigate("why is pod crashing"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestClient_Chat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/chat" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		var req holmesChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.Ask != "create an issue" {
			t.Errorf("unexpected ask: %s", req.Ask)
		}
		if !strings.Contains(req.AdditionalSystemPrompt, "Japanese") {
			t.Errorf("expected Chat's additional_system_prompt to still request Japanese, got: %q", req.AdditionalSystemPrompt)
		}
		if !strings.Contains(req.AdditionalSystemPrompt, "mrkdwn") {
			t.Errorf("expected Chat's additional_system_prompt to still request Slack mrkdwn, got: %q", req.AdditionalSystemPrompt)
		}
		if !strings.Contains(req.AdditionalSystemPrompt, "create_issue") {
			t.Errorf("expected Chat's additional_system_prompt to include issue-detection instructions, got: %q", req.AdditionalSystemPrompt)
		}
		json.NewEncoder(w).Encode(holmesChatResponse{Analysis: `{"action":"create_issue","repo":"panicboat/monorepo","ready":false,"reason":"test"}`})
	}))
	defer server.Close()

	client := New(server.URL, "sonnet-4-6")
	resp, err := client.Chat("create an issue")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(resp, "create_issue") {
		t.Errorf("expected the response to pass through unchanged, got: %q", resp)
	}
}

func TestClient_Chat_ErrorStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := New(server.URL, "sonnet-4-6")
	if _, err := client.Chat("test"); err == nil {
		t.Fatal("expected error, got nil")
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/holmes/... -v -run 'TestClient_Chat|TestClient_Investigate_NoIssueInstructions'`
Expected: FAIL — `client.Chat` doesn't exist yet (build failure).

- [ ] **Step 3: Add `issueIntentInstructions` and `Chat`, extracting the shared HTTP call**

In `system-components/holmes/workspace/internal/clients/holmes/client.go`, find:

```go
func (c *Client) Investigate(ask string) (string, error) {
	reqBody, err := json.Marshal(holmesChatRequest{
		Ask:                    ask,
		Model:                  c.Model,
		AdditionalSystemPrompt: slackFormattingInstructions,
	})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/chat", bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call holmes api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("holmes api returned status %d", resp.StatusCode)
	}

	var chatResp holmesChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	return chatResp.Analysis, nil
}
```

Replace with:

```go
// issueIntentInstructions is appended to Chat's additional_system_prompt only
// (never Investigate's — Alertmanager's fixed alert-investigation ask never
// carries human issue-creation intent, so keeping this off that path means it
// can never receive or need to parse a create_issue envelope).
const issueIntentInstructions = `Additionally, decide whether the message (in the context of the
full thread above) requests creating a GitHub issue.

If it does not, ignore the rest of this section and respond exactly as instructed above.

If it does, respond with ONLY this JSON object and nothing else — no surrounding text, no
mrkdwn, no code fence:
{"action":"create_issue","repo":"owner/repo","title":"...","body":"...","ready":true,"reason":"..."}

- "repo": the target repository. Use the repository the user explicitly named in their
  message. If they did not name one, infer it from the investigation context (for example,
  where source-investigation located the relevant code).
- "ready": true if the user explicitly named the repo, or if the thread shows they already
  confirmed a repo you previously proposed. false if you inferred the repo and it has not
  yet been confirmed.
- "title", "body": required only when ready is true. Synthesize them from the full
  investigation in this thread — do not just copy the single most recent message. "body"
  must use standard GitHub Markdown (headings with #, **bold**, [text](url) links, "- "
  bullets), not Slack mrkdwn, since it becomes a GitHub issue body.
- "reason": required only when ready is false — a short explanation of why you inferred
  this repo, so the user can judge whether to confirm it. Omit when ready is true.`

func (c *Client) Investigate(ask string) (string, error) {
	return c.chat(ask, slackFormattingInstructions)
}

// Chat is used by the Slack mention flow — same request/response shape as
// Investigate, but its additional_system_prompt also asks HolmesGPT to
// detect GitHub issue-creation intent (see issueIntentInstructions).
func (c *Client) Chat(ask string) (string, error) {
	return c.chat(ask, slackFormattingInstructions+"\n\n"+issueIntentInstructions)
}

func (c *Client) chat(ask, additionalSystemPrompt string) (string, error) {
	reqBody, err := json.Marshal(holmesChatRequest{
		Ask:                    ask,
		Model:                  c.Model,
		AdditionalSystemPrompt: additionalSystemPrompt,
	})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/chat", bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call holmes api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("holmes api returned status %d", resp.StatusCode)
	}

	var chatResp holmesChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	return chatResp.Analysis, nil
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/holmes/... -v`
Expected: PASS — all tests, including the pre-existing `TestClient_Investigate` (still asserts `Japanese`/`mrkdwn`, unaffected by this change) and `TestClient_Investigate_ErrorStatus`.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/workspace/internal/clients/holmes/
git commit -s -m "feat(holmes): add Chat method with issue-creation intent detection"
```

---

## Task 4: Wire issue creation into the Slack handler

**Files:**
- Modify: `system-components/holmes/workspace/internal/handlers/slack/handler.go`
- Modify: `system-components/holmes/workspace/internal/handlers/slack/handler_test.go`
- Modify: `system-components/holmes/workspace/main.go`

**Interfaces:**
- Consumes: `holmes.Client.Chat(ask string) (string, error)` (Task 3), `github.Client.CreateIssue(repo, title, body string) (string, error)` and `github.New(appID, privateKeyPEM, installationID string) (*github.Client, error)` (Task 1), `config.Config.GitHubAppID` / `GitHubAppPrivateKey` / `GitHubAppInstallationID` (Task 2).
- Produces: `Handler.GitHub issueCreator` field — nothing downstream depends on this (last handler task).

- [ ] **Step 1: Write the failing tests**

In `system-components/holmes/workspace/internal/handlers/slack/handler_test.go`, first rename the existing `TestHandleMention_InvestigateFailure` to `TestHandleMention_ChatFailure` (it now exercises `Chat`, not `Investigate` — same body, only the name changes to match):

Find:
```go
func TestHandleMention_InvestigateFailure(t *testing.T) {
```
Replace with:
```go
func TestHandleMention_ChatFailure(t *testing.T) {
```

Then add these new tests at the end of the file:

```go
type fakeGitHub struct {
	createIssueFunc func(repo, title, body string) (string, error)
	calledRepo      string
	calledTitle     string
	calledBody      string
}

func (f *fakeGitHub) CreateIssue(repo, title, body string) (string, error) {
	f.calledRepo = repo
	f.calledTitle = title
	f.calledBody = body
	return f.createIssueFunc(repo, title, body)
}

func TestHandleMention_CreateIssue_ReadyTrue(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted = append(posted, body)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": `{"action":"create_issue","repo":"panicboat/monorepo","title":"bug title","body":"bug body","ready":true}`,
		})
	}))
	defer holmesServer.Close()

	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string) (string, error) {
		return "https://github.com/panicboat/monorepo/issues/42", nil
	}}

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: &slackclient.Client{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
		GitHub: gh,
	}

	h.handleMention(slackInnerEvent{
		Type: "app_mention", Channel: "C123", User: "U1",
		Text: "<@BOT> create an issue in panicboat/monorepo", Ts: "100",
	})

	if gh.calledRepo != "panicboat/monorepo" || gh.calledTitle != "bug title" || gh.calledBody != "bug body" {
		t.Errorf("unexpected CreateIssue call: repo=%q title=%q body=%q", gh.calledRepo, gh.calledTitle, gh.calledBody)
	}
	final := posted[len(posted)-1]
	if !strings.Contains(final["text"], "https://github.com/panicboat/monorepo/issues/42") {
		t.Errorf("expected the final post to contain the issue URL, got: %+v", final)
	}
}

func TestHandleMention_CreateIssue_ReadyFalse(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted = append(posted, body)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": `{"action":"create_issue","repo":"panicboat/platform","ready":false,"reason":"source investigation found the bug there"}`,
		})
	}))
	defer holmesServer.Close()

	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string) (string, error) {
		t.Fatal("CreateIssue must not be called when ready is false")
		return "", nil
	}}

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: &slackclient.Client{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
		GitHub: gh,
	}

	h.handleMention(slackInnerEvent{
		Type: "app_mention", Channel: "C123", User: "U1",
		Text: "<@BOT> create an issue for this", Ts: "100",
	})

	final := posted[len(posted)-1]
	if !strings.Contains(final["text"], "panicboat/platform") {
		t.Errorf("expected the confirmation message to name the inferred repo, got: %+v", final)
	}
	if !strings.Contains(final["text"], "source investigation found the bug there") {
		t.Errorf("expected the confirmation message to include the reason, got: %+v", final)
	}
}

func TestHandleMention_CreateIssue_GitHubError(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted = append(posted, body)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": `{"action":"create_issue","repo":"panicboat/monorepo","title":"t","body":"b","ready":true}`,
		})
	}))
	defer holmesServer.Close()

	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string) (string, error) {
		return "", fmt.Errorf("github api returned status 404 creating issue in panicboat/monorepo")
	}}

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: &slackclient.Client{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
		GitHub: gh,
	}

	h.handleMention(slackInnerEvent{
		Type: "app_mention", Channel: "C123", User: "U1",
		Text: "<@BOT> create an issue", Ts: "100",
	})

	final := posted[len(posted)-1]
	if !strings.Contains(final["text"], "404") {
		t.Errorf("expected the GitHub error to be reported in the thread, got: %+v", final)
	}
}
```

Also add one more test, after `TestHandleMention_CreateIssue_ReadyTrue`, covering a real LLM failure mode: wrapping the JSON in a markdown code fence despite `issueIntentInstructions` saying not to.

```go
func TestHandleMention_CreateIssue_CodeFenceWrapped(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted = append(posted, body)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": "```json\n" + `{"action":"create_issue","repo":"panicboat/monorepo","title":"t","body":"b","ready":true}` + "\n```",
		})
	}))
	defer holmesServer.Close()

	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string) (string, error) {
		return "https://github.com/panicboat/monorepo/issues/1", nil
	}}

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: &slackclient.Client{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
		GitHub: gh,
	}

	h.handleMention(slackInnerEvent{
		Type: "app_mention", Channel: "C123", User: "U1",
		Text: "<@BOT> create an issue", Ts: "100",
	})

	if gh.calledRepo != "panicboat/monorepo" {
		t.Errorf("expected CreateIssue to be called despite the code-fence wrapping, got repo=%q", gh.calledRepo)
	}
	final := posted[len(posted)-1]
	if !strings.Contains(final["text"], "https://github.com/panicboat/monorepo/issues/1") {
		t.Errorf("expected the final post to contain the issue URL, got: %+v", final)
	}
}
```

This test file needs one new import: add `"fmt"` to the existing `import` block (used by `TestHandleMention_CreateIssue_GitHubError`'s `fmt.Errorf`).

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd system-components/holmes/workspace && go test ./internal/handlers/slack/... -v`
Expected: FAIL (build failure — `Handler.GitHub` field and `investigator.Chat` don't exist yet).

- [ ] **Step 3: Update the handler**

In `system-components/holmes/workspace/internal/handlers/slack/handler.go`, find:

```go
type investigator interface {
	Investigate(ask string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
}
```

Replace with:

```go
type investigator interface {
	Chat(ask string) (string, error)
}

type issueCreator interface {
	CreateIssue(repo, title, body string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
}

type issueAction struct {
	Action string `json:"action"`
	Repo   string `json:"repo"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	Ready  bool   `json:"ready"`
	Reason string `json:"reason"`
}
```

Find:

```go
type Handler struct {
	Cfg    config.Config
	Holmes investigator
	Client messagePoster
}
```

Replace with:

```go
type Handler struct {
	Cfg    config.Config
	Holmes investigator
	Client messagePoster
	GitHub issueCreator
}
```

Find:

```go
func (h *Handler) handleMention(evt slackInnerEvent) {
	threadTs := evt.ThreadTs
	if threadTs == "" {
		threadTs = evt.Ts
	}

	ask := slackclient.StripMention(evt.Text)

	if evt.ThreadTs != "" {
		history, err := h.Client.ConversationsReplies(evt.Channel, evt.ThreadTs)
		if err != nil {
			log.Printf("failed to fetch thread history: %v", err)
		} else if len(history) > 0 {
			ask = slackclient.BuildAskWithHistory(history, ask)
		}
	}

	if _, err := h.Client.PostMessage(evt.Channel, threadTs, "🔍 investigating..."); err != nil {
		log.Printf("failed to post ack message: %v", err)
	}

	analysis, err := h.Holmes.Investigate(ask)
	if err != nil {
		if _, postErr := h.Client.PostMessage(evt.Channel, threadTs, fmt.Sprintf("investigation failed: %v", err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if _, err := h.Client.PostMessage(evt.Channel, threadTs, analysis); err != nil {
		log.Printf("failed to post analysis: %v", err)
	}
}
```

Replace with:

```go
func (h *Handler) handleMention(evt slackInnerEvent) {
	threadTs := evt.ThreadTs
	if threadTs == "" {
		threadTs = evt.Ts
	}

	ask := slackclient.StripMention(evt.Text)

	if evt.ThreadTs != "" {
		history, err := h.Client.ConversationsReplies(evt.Channel, evt.ThreadTs)
		if err != nil {
			log.Printf("failed to fetch thread history: %v", err)
		} else if len(history) > 0 {
			ask = slackclient.BuildAskWithHistory(history, ask)
		}
	}

	if _, err := h.Client.PostMessage(evt.Channel, threadTs, "🔍 investigating..."); err != nil {
		log.Printf("failed to post ack message: %v", err)
	}

	response, err := h.Holmes.Chat(ask)
	if err != nil {
		if _, postErr := h.Client.PostMessage(evt.Channel, threadTs, fmt.Sprintf("investigation failed: %v", err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	var action issueAction
	if err := json.Unmarshal([]byte(stripCodeFence(response)), &action); err == nil && action.Action == "create_issue" {
		h.handleIssueAction(evt.Channel, threadTs, action)
		return
	}

	if _, err := h.Client.PostMessage(evt.Channel, threadTs, response); err != nil {
		log.Printf("failed to post analysis: %v", err)
	}
}

// handleIssueAction either asks the user to confirm an inferred repo, or
// creates the issue and reports the result — never both.
func (h *Handler) handleIssueAction(channel, threadTs string, action issueAction) {
	if !action.Ready {
		msg := fmt.Sprintf("推定した repo は `%s` です（理由: %s）。作成してよければ「はい」と返信してください。", action.Repo, action.Reason)
		if _, err := h.Client.PostMessage(channel, threadTs, msg); err != nil {
			log.Printf("failed to post confirmation request: %v", err)
		}
		return
	}

	url, err := h.GitHub.CreateIssue(action.Repo, action.Title, action.Body)
	if err != nil {
		if _, postErr := h.Client.PostMessage(channel, threadTs, fmt.Sprintf("issue creation failed: %v", err)); postErr != nil {
			log.Printf("failed to post issue creation error: %v", postErr)
		}
		return
	}

	if _, err := h.Client.PostMessage(channel, threadTs, fmt.Sprintf("Issue を作成しました: %s", url)); err != nil {
		log.Printf("failed to post issue creation result: %v", err)
	}
}

// stripCodeFence removes a surrounding markdown code fence (```json ... ```
// or ``` ... ```), if present. issueIntentInstructions tells HolmesGPT not
// to wrap its JSON envelope in one, but LLMs commonly do anyway — this
// keeps that response parseable instead of silently falling back to
// posting the raw fenced text as if it were a normal analysis.
func stripCodeFence(s string) string {
	trimmed := strings.TrimSpace(s)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	return strings.TrimSpace(trimmed)
}
```

Finally, add `"strings"` to `handler.go`'s existing `import` block (currently `encoding/json`, `fmt`, `io`, `log`, `net/http`, `time`, plus the `slackclient`/`config` package imports) — used by `stripCodeFence`.

- [ ] **Step 4: Wire the GitHub client into `main.go`**

In `system-components/holmes/workspace/main.go`, find:

```go
import (
	"log"
	"net/http"

	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/holmes"
	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
	"github.com/panicboat/monorepo/system-components/holmes/internal/handlers/alertmanager"
	slackhandler "github.com/panicboat/monorepo/system-components/holmes/internal/handlers/slack"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	holmesClient := holmes.New(cfg.HolmesAPIURL, cfg.HolmesModel)
	slackClient := slack.New(cfg.SlackBotToken)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/slack/events", &slackhandler.Handler{Cfg: cfg, Holmes: holmesClient, Client: slackClient})
	mux.Handle("/alertmanager/webhook", &alertmanager.Handler{Cfg: cfg, Holmes: holmesClient, Client: slackClient})
```

Replace with:

```go
import (
	"log"
	"net/http"

	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/github"
	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/holmes"
	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
	"github.com/panicboat/monorepo/system-components/holmes/internal/handlers/alertmanager"
	slackhandler "github.com/panicboat/monorepo/system-components/holmes/internal/handlers/slack"
)

func main() {
	cfg, err := config.Load()
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
	mux.Handle("/alertmanager/webhook", &alertmanager.Handler{Cfg: cfg, Holmes: holmesClient, Client: slackClient})
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd system-components/holmes/workspace && go test ./internal/handlers/slack/... -v`
Expected: PASS — all tests, including the 4 pre-existing tests (`TestHandler_URLVerification`, `TestHandler_InvalidSignature`, `TestHandleMention_TopLevelMention`, `TestHandleMention_ThreadHistory`, `TestHandleMention_ConversationsRepliesFailure`, `TestHandleMention_ChatFailure`) — these are expected to pass unmodified except the one rename in Step 1, since the fake `holmesServer` they use returns the same `{"analysis": "..."}` shape regardless of which method (`Investigate` vs `Chat`) requested it.

- [ ] **Step 6: Build the whole module**

Run: `cd system-components/holmes/workspace && go build ./... && go vet ./... && go test ./... -race`
Expected: builds clean, vet clean, all packages PASS.

- [ ] **Step 7: Commit**

```bash
git add system-components/holmes/workspace/internal/handlers/slack/ system-components/holmes/workspace/main.go
git commit -s -m "feat(holmes): create GitHub issues from natural-language Slack requests"
```

---

## Task 5: Kubernetes secret and deployment wiring

**Files:**
- Modify: `system-components/holmes/kubernetes/overlays/production/external-secret.yaml`
- Modify: `system-components/holmes/kubernetes/base/deployment.yaml`

**Interfaces:** none — this task only wires already-registered AWS Secrets Manager values (`panicboat/holmes/github`, already populated) into the running container as env vars, matching the names `config.Load()` reads (Task 2).

- [ ] **Step 1: Add the `holmes-github` ExternalSecret**

In `system-components/holmes/kubernetes/overlays/production/external-secret.yaml`, find the end of the file:

```yaml
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

Replace with:

```yaml
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
---
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: holmes-github
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: holmes-github
    creationPolicy: Owner
  data:
    - secretKey: GITHUB_APP_ID
      remoteRef:
        key: panicboat/holmes/github
        property: app_id
    - secretKey: GITHUB_APP_PRIVATE_KEY
      remoteRef:
        key: panicboat/holmes/github
        property: private_key
    - secretKey: GITHUB_APP_INSTALLATION_ID
      remoteRef:
        key: panicboat/holmes/github
        property: installation_id
```

- [ ] **Step 2: Add the `holmes-github` secretRef to the Deployment**

In `system-components/holmes/kubernetes/base/deployment.yaml`, find:

```yaml
          envFrom:
            - configMapRef:
                name: holmes
            - secretRef:
                name: holmes-slack
            - secretRef:
                name: holmes-alertmanager
```

Replace with:

```yaml
          envFrom:
            - configMapRef:
                name: holmes
            - secretRef:
                name: holmes-slack
            - secretRef:
                name: holmes-alertmanager
            - secretRef:
                name: holmes-github
```

- [ ] **Step 3: Hydrate and inspect the diff**

Run: `kustomize build system-components/holmes/kubernetes/overlays/production`
Expected: renders cleanly (no errors); output includes the new `holmes-github` `ExternalSecret` and the `Deployment`'s `envFrom` list includes `holmes-github`.

- [ ] **Step 4: Commit**

```bash
git add system-components/holmes/kubernetes/
git commit -s -m "feat(holmes): wire GitHub App secret into the deployment"
```

---

## Task 6: Open Draft PR

**Files:** none (git/GitHub operations only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/holmes-github-issue
```

- [ ] **Step 2: Open a Draft PR**

```bash
gh pr create --draft --title "feat(system-components/holmes): create GitHub issues from natural-language Slack requests" --body "$(cat <<'EOF'
## Summary
- HolmesGPT gains a second additional_system_prompt variant (`Chat`, Slack-mention path only) that detects GitHub issue-creation intent from natural language and responds with a structured JSON envelope instead of free text when detected.
- New `internal/clients/github` package: a GitHub App client (stdlib-only RS256 JWT signing, no new dependency) that creates issues via an installation access token.
- The Slack handler creates the issue immediately when the user named the repo explicitly (or already confirmed an inferred one), or asks for confirmation first when the repo was inferred from investigation context.
- Alertmanager's `Investigate` path is untouched — issue-detection instructions are only ever sent via `Chat`.

## Test plan
- [x] `go build ./... && go vet ./... && go test ./... -race` — all pass
- [ ] After merge and deploy: ask holmes to create an issue with an explicit repo in a Slack thread, confirm the issue appears
- [ ] Ask holmes to create an issue without naming a repo, confirm it asks for confirmation and creates the issue only after a "はい" reply

Design: docs/superpowers/specs/2026-08-17-holmes-github-issue-design.md (panicboat/platform repo)
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Self-Review Notes

- **Spec coverage**: the design doc's JSON contract (including the `reason` field added during spec self-review), stateless confirmation, `Chat`/`Investigate` separation, GitHub App auth, and secret wiring are each covered by a task above.
- **Placeholder scan**: none — all code blocks are complete, no TBD markers.
- **Type/naming consistency**: `issueAction` (Task 4) field names match the JSON contract exactly (`action`, `repo`, `title`, `body`, `ready`, `reason`) as specified in Task 3's `issueIntentInstructions` and the design doc. `github.New`'s signature and `CreateIssue`'s signature are identical between where Task 1 defines them and where Task 4 consumes them.
- **Scope boundary**: no `panicboat/platform` changes — confirmed by the design doc's Scope section (holmes's secret provisioning is entirely monorepo-side). The Alertmanager handler package is never touched by any task.
- **Test-boundary note for the implementer**: Task 4's `fakeGitHub` (a hand-rolled interface fake) deliberately departs from this handler package's existing convention of using real concrete clients (`holmesclient.New`, `slackclient.Client{}`) against `httptest` servers. `github.Client` requires a parsed RSA key to construct, which Task 1's own tests already cover in depth (JWT signing, token exchange, caching) — re-deriving that setup here would test the same thing twice for no benefit to what Task 4 actually verifies (the handler's branching on the JSON envelope). A hand-rolled fake keeps that verification focused.
- **Reliability gap found and fixed during self-review**: the initial draft parsed `Chat`'s response with a bare `json.Unmarshal`, which silently falls back to "post as plain text" if HolmesGPT wraps its JSON envelope in a markdown code fence despite `issueIntentInstructions` saying not to — a common LLM failure mode, not a hypothetical one. Task 4 now strips a surrounding code fence (`stripCodeFence`) before parsing, with a dedicated test (`TestHandleMention_CreateIssue_CodeFenceWrapped`) covering it.
