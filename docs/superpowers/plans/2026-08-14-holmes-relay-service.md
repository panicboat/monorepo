# holmes-relay Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `holmes-relay`, a Go service in `services/holmes-relay/` that receives Slack `app_mention` events and Alertmanager webhooks, calls HolmesGPT's `/api/chat`, and posts the result back to Slack.

**Architecture:** A single Go binary with no third-party dependencies (stdlib `net/http` only). Two HTTP handlers (`/slack/events`, `/alertmanager/webhook`) share a `HolmesClient` (calls the in-cluster HolmesGPT API) and a `slackAPIClient` (posts to Slack). Deployed via the existing monorepo per-service pattern (Dockerfile + Kustomize base/overlay + Flux image automation + Cilium Gateway HTTPRoute), matching `services/frontend` and `services/monolith`.

**Tech Stack:** Go 1.24 (stdlib only, no framework), Docker (multi-stage, `golang:1.24-alpine` builder → `gcr.io/distroless/static-debian12:nonroot` runtime), Kustomize, Terragrunt (AWS Secrets Manager secret scaffolding), Gateway API (Cilium).

## Global Constraints

- No third-party Go dependencies — stdlib only (`net/http`, `crypto/hmac`, `crypto/sha256`, `encoding/json`, etc). Source: design spec's "minimal construction" decision.
- Default Holmes model: `sonnet-4-6` (sonnet-5 is blocked by an unresolved Bedrock service quota — see `bedrock-5gen-quota-blocker` — do not default to it).
- Holmes API base URL: `http://holmesgpt-holmes.holmesgpt.svc.cluster.local` (ClusterIP, in-cluster only, no new external exposure of Holmes itself).
- Design doc: `docs/superpowers/specs/2026-08-14-holmes-relay-design.md` (in `panicboat/platform` repo).

---

## Task 1: Module scaffold, config loader, health endpoint

**Files:**
- Create: `services/holmes-relay/workspace/go.mod`
- Create: `services/holmes-relay/workspace/config.go`
- Create: `services/holmes-relay/workspace/config_test.go`
- Create: `services/holmes-relay/workspace/main.go`

**Interfaces:**
- Produces: `type Config struct { SlackSigningSecret, SlackBotToken, AlertmanagerToken, HolmesAPIURL, HolmesModel string }` and `func loadConfig() (Config, error)`, both used by every later task.

- [ ] **Step 1: Create the Go module**

```bash
mkdir -p services/holmes-relay/workspace
cd services/holmes-relay/workspace
go mod init github.com/panicboat/monorepo/services/holmes-relay
```

- [ ] **Step 2: Write the failing test for config loading**

`services/holmes-relay/workspace/config_test.go`:

```go
package main

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

func TestLoadConfig_AllRequiredPresent(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "HOLMES_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	os.Unsetenv("HOLMES_MODEL")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HolmesModel != "sonnet-4-6" {
		t.Errorf("expected default model sonnet-4-6, got %q", cfg.HolmesModel)
	}
}

func TestLoadConfig_MissingRequired(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "HOLMES_API_URL", "http://example.invalid")

	if _, err := loadConfig(); err == nil {
		t.Fatal("expected error when SLACK_SIGNING_SECRET is missing, got nil")
	}
}
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `cd services/holmes-relay/workspace && go test ./... -run TestLoadConfig -v`
Expected: FAIL (`loadConfig` undefined)

- [ ] **Step 3: Implement config loader**

`services/holmes-relay/workspace/config.go`:

```go
package main

import (
	"fmt"
	"os"
)

type Config struct {
	SlackSigningSecret string
	SlackBotToken      string
	AlertmanagerToken  string
	HolmesAPIURL       string
	HolmesModel        string
}

func loadConfig() (Config, error) {
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

- [ ] **Step 4: Write the stub entrypoint**

`services/holmes-relay/workspace/main.go`:

```go
package main

import (
	"log"
	"net/http"
)

func main() {
	if _, err := loadConfig(); err != nil {
		log.Fatalf("config error: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	addr := ":8080"
	log.Printf("holmes-relay listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 5: Run tests and build**

Run: `cd services/holmes-relay/workspace && go test ./... -v && go build ./...`
Expected: PASS, build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add services/holmes-relay/workspace/go.mod services/holmes-relay/workspace/config.go services/holmes-relay/workspace/config_test.go services/holmes-relay/workspace/main.go
git commit -s -m "feat(holmes-relay): add config loader and health endpoint"
```

---

## Task 2: Holmes API client

**Files:**
- Create: `services/holmes-relay/workspace/holmes.go`
- Create: `services/holmes-relay/workspace/holmes_test.go`

**Interfaces:**
- Consumes: nothing from Task 1 directly (standalone HTTP client).
- Produces: `type HolmesClient struct { BaseURL, Model string; HTTPClient *http.Client }`, `func NewHolmesClient(baseURL, model string) *HolmesClient`, `func (c *HolmesClient) Investigate(ask string) (string, error)` — used by Task 4 (slack handler) and Task 5 (alertmanager handler).

- [ ] **Step 1: Write the failing test**

`services/holmes-relay/workspace/holmes_test.go`:

```go
package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHolmesClient_Investigate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/chat" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		var req holmesChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.Model != "sonnet-4-6" {
			t.Errorf("unexpected model: %s", req.Model)
		}
		if req.Ask != "why is pod crashing" {
			t.Errorf("unexpected ask: %s", req.Ask)
		}
		json.NewEncoder(w).Encode(holmesChatResponse{Analysis: "root cause found"})
	}))
	defer server.Close()

	client := NewHolmesClient(server.URL, "sonnet-4-6")
	analysis, err := client.Investigate("why is pod crashing")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if analysis != "root cause found" {
		t.Errorf("got %q, want %q", analysis, "root cause found")
	}
}

func TestHolmesClient_Investigate_ErrorStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewHolmesClient(server.URL, "sonnet-4-6")
	if _, err := client.Investigate("test"); err == nil {
		t.Fatal("expected error, got nil")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/holmes-relay/workspace && go test ./... -run TestHolmesClient -v`
Expected: FAIL (`HolmesClient` undefined)

- [ ] **Step 3: Implement the client**

`services/holmes-relay/workspace/holmes.go`:

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type HolmesClient struct {
	BaseURL    string
	Model      string
	HTTPClient *http.Client
}

func NewHolmesClient(baseURL, model string) *HolmesClient {
	return &HolmesClient{
		BaseURL: baseURL,
		Model:   model,
		HTTPClient: &http.Client{
			Timeout: 90 * time.Second,
		},
	}
}

type holmesChatRequest struct {
	Ask   string `json:"ask"`
	Model string `json:"model"`
}

type holmesChatResponse struct {
	Analysis string `json:"analysis"`
}

func (c *HolmesClient) Investigate(ask string) (string, error) {
	reqBody, err := json.Marshal(holmesChatRequest{Ask: ask, Model: c.Model})
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

- [ ] **Step 4: Run tests**

Run: `cd services/holmes-relay/workspace && go test ./... -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/holmes-relay/workspace/holmes.go services/holmes-relay/workspace/holmes_test.go
git commit -s -m "feat(holmes-relay): add HolmesGPT /api/chat client"
```

---

## Task 3: Slack signature verification and mention parsing

**Files:**
- Create: `services/holmes-relay/workspace/slack_verify.go`
- Create: `services/holmes-relay/workspace/slack_verify_test.go`

**Interfaces:**
- Produces: `func verifySlackSignature(signingSecret string, header http.Header, body []byte, now time.Time) error`, `func stripMention(text string) string`, `type slackMessage struct { Text, User, Ts string }`, `func buildAskWithHistory(history []slackMessage, ask string) string` — used by Task 4.

- [ ] **Step 1: Write the failing tests**

`services/holmes-relay/workspace/slack_verify_test.go`:

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"
)

func sign(secret, tsStr string, body []byte) string {
	baseString := "v0:" + tsStr + ":" + string(body)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(baseString))
	return "v0=" + hex.EncodeToString(mac.Sum(nil))
}

func TestVerifySlackSignature_Valid(t *testing.T) {
	secret := "test-signing-secret"
	body := []byte(`{"type":"url_verification","challenge":"abc"}`)
	now := time.Now()
	tsStr := strconv.FormatInt(now.Unix(), 10)

	header := http.Header{}
	header.Set("X-Slack-Request-Timestamp", tsStr)
	header.Set("X-Slack-Signature", sign(secret, tsStr, body))

	if err := verifySlackSignature(secret, header, body, now); err != nil {
		t.Fatalf("expected valid signature, got error: %v", err)
	}
}

func TestVerifySlackSignature_Invalid(t *testing.T) {
	header := http.Header{}
	header.Set("X-Slack-Request-Timestamp", strconv.FormatInt(time.Now().Unix(), 10))
	header.Set("X-Slack-Signature", "v0=deadbeef")

	if err := verifySlackSignature("secret", header, []byte("body"), time.Now()); err == nil {
		t.Fatal("expected error for invalid signature, got nil")
	}
}

func TestVerifySlackSignature_TooOld(t *testing.T) {
	secret := "test-signing-secret"
	body := []byte("body")
	old := time.Now().Add(-10 * time.Minute)
	tsStr := strconv.FormatInt(old.Unix(), 10)

	header := http.Header{}
	header.Set("X-Slack-Request-Timestamp", tsStr)
	header.Set("X-Slack-Signature", sign(secret, tsStr, body))

	if err := verifySlackSignature(secret, header, body, time.Now()); err == nil {
		t.Fatal("expected error for stale timestamp, got nil")
	}
}

func TestStripMention(t *testing.T) {
	cases := map[string]string{
		"<@U123ABC> investigate the frontend pod": "investigate the frontend pod",
		"<@U123ABC><@U456DEF> investigate":        "investigate",
		"no mention here":                         "no mention here",
	}
	for input, want := range cases {
		if got := stripMention(input); got != want {
			t.Errorf("stripMention(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestBuildAskWithHistory(t *testing.T) {
	history := []slackMessage{
		{Text: "frontend pods are crashlooping", User: "U1"},
		{Text: "started 10 minutes ago", User: "U1"},
	}
	got := buildAskWithHistory(history, "what's the root cause?")
	if !strings.Contains(got, "frontend pods are crashlooping") {
		t.Errorf("expected history text in result, got: %s", got)
	}
	if !strings.Contains(got, "what's the root cause?") {
		t.Errorf("expected ask text in result, got: %s", got)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/holmes-relay/workspace && go test ./... -run "TestVerifySlackSignature|TestStripMention|TestBuildAskWithHistory" -v`
Expected: FAIL (undefined symbols)

- [ ] **Step 3: Implement**

`services/holmes-relay/workspace/slack_verify.go`:

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func verifySlackSignature(signingSecret string, header http.Header, body []byte, now time.Time) error {
	tsStr := header.Get("X-Slack-Request-Timestamp")
	sig := header.Get("X-Slack-Signature")
	if tsStr == "" || sig == "" {
		return fmt.Errorf("missing signature headers")
	}

	ts, err := strconv.ParseInt(tsStr, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid timestamp: %w", err)
	}
	if now.Sub(time.Unix(ts, 0)).Abs() > 5*time.Minute {
		return fmt.Errorf("timestamp too old")
	}

	baseString := "v0:" + tsStr + ":" + string(body)
	mac := hmac.New(sha256.New, []byte(signingSecret))
	mac.Write([]byte(baseString))
	expected := "v0=" + hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(sig)) {
		return fmt.Errorf("signature mismatch")
	}
	return nil
}

var mentionPrefix = regexp.MustCompile(`^\s*(<@[A-Z0-9]+>\s*)+`)

func stripMention(text string) string {
	return strings.TrimSpace(mentionPrefix.ReplaceAllString(text, ""))
}

type slackMessage struct {
	Text string `json:"text"`
	User string `json:"user"`
	Ts   string `json:"ts"`
}

func buildAskWithHistory(history []slackMessage, ask string) string {
	var b strings.Builder
	b.WriteString("Slack thread context:\n")
	for _, m := range history {
		b.WriteString(fmt.Sprintf("- %s\n", m.Text))
	}
	b.WriteString("\nInvestigation request: ")
	b.WriteString(ask)
	return b.String()
}
```

- [ ] **Step 4: Run tests**

Run: `cd services/holmes-relay/workspace && go test ./... -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/holmes-relay/workspace/slack_verify.go services/holmes-relay/workspace/slack_verify_test.go
git commit -s -m "feat(holmes-relay): add Slack signature verification and mention parsing"
```

---

## Task 4: Slack API client and event handler

**Files:**
- Create: `services/holmes-relay/workspace/slack_api.go`
- Create: `services/holmes-relay/workspace/slack_api_test.go`
- Create: `services/holmes-relay/workspace/slack_handler.go`
- Create: `services/holmes-relay/workspace/slack_handler_test.go`
- Modify: `services/holmes-relay/workspace/main.go`

**Interfaces:**
- Consumes: `HolmesClient.Investigate` (Task 2), `verifySlackSignature`/`stripMention`/`buildAskWithHistory`/`slackMessage` (Task 3), `Config` (Task 1).
- Produces: `type slackAPIClient struct { BotToken, BaseURL string; HTTPClient *http.Client }`, `func newSlackAPIClient(botToken string) *slackAPIClient`, `func (c *slackAPIClient) PostMessage(channel, threadTs, text string) error`, `func (c *slackAPIClient) ConversationsReplies(channel, threadTs string) ([]slackMessage, error)`, `type slackHandler struct { cfg Config; holmes *HolmesClient; client *slackAPIClient }` implementing `http.Handler` — used by Task 5's `main.go` wiring is shared, and by manual/integration testing.

- [ ] **Step 1: Write the failing test for the Slack API client**

`services/holmes-relay/workspace/slack_api_test.go`:

```go
package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSlackAPIClient_PostMessage(t *testing.T) {
	var gotBody map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat.postMessage" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if auth := r.Header.Get("Authorization"); auth != "Bearer xoxb-test" {
			t.Errorf("unexpected authorization header: %s", auth)
		}
		json.NewDecoder(r.Body).Decode(&gotBody)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()

	c := newSlackAPIClient("xoxb-test")
	c.BaseURL = server.URL
	if err := c.PostMessage("C123", "T123", "hello"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotBody["channel"] != "C123" || gotBody["thread_ts"] != "T123" || gotBody["text"] != "hello" {
		t.Errorf("unexpected body: %+v", gotBody)
	}
}

func TestSlackAPIClient_PostMessage_NoThread(t *testing.T) {
	var gotBody map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&gotBody)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()

	c := newSlackAPIClient("xoxb-test")
	c.BaseURL = server.URL
	if err := c.PostMessage("C123", "", "hello"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, present := gotBody["thread_ts"]; present {
		t.Errorf("expected no thread_ts key when threadTs is empty, got: %+v", gotBody)
	}
}

func TestSlackAPIClient_ConversationsReplies(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/conversations.replies" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"messages": []slackMessage{
				{Text: "first message", User: "U1", Ts: "1"},
				{Text: "second message", User: "U2", Ts: "2"},
			},
		})
	}))
	defer server.Close()

	c := newSlackAPIClient("xoxb-test")
	c.BaseURL = server.URL
	msgs, err := c.ConversationsReplies("C123", "1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(msgs))
	}
}

func TestSlackAPIClient_PostMessage_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "channel_not_found"})
	}))
	defer server.Close()

	c := newSlackAPIClient("xoxb-test")
	c.BaseURL = server.URL
	if err := c.PostMessage("C123", "", "hello"); err == nil {
		t.Fatal("expected error, got nil")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/holmes-relay/workspace && go test ./... -run TestSlackAPIClient -v`
Expected: FAIL (`slackAPIClient` undefined)

- [ ] **Step 3: Implement the Slack API client**

`services/holmes-relay/workspace/slack_api.go`:

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	neturl "net/url"
	"net/http"
	"time"
)

type slackAPIClient struct {
	BotToken   string
	BaseURL    string
	HTTPClient *http.Client
}

func newSlackAPIClient(botToken string) *slackAPIClient {
	return &slackAPIClient{
		BotToken:   botToken,
		BaseURL:    "https://slack.com/api",
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *slackAPIClient) PostMessage(channel, threadTs, text string) error {
	payload := map[string]string{
		"channel": channel,
		"text":    text,
	}
	if threadTs != "" {
		payload["thread_ts"] = threadTs
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/chat.postMessage", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", "Bearer "+c.BotToken)

	return c.doSlackRequest(req)
}

func (c *slackAPIClient) ConversationsReplies(channel, threadTs string) ([]slackMessage, error) {
	url := fmt.Sprintf("%s/conversations.replies?channel=%s&ts=%s",
		c.BaseURL, neturl.QueryEscape(channel), neturl.QueryEscape(threadTs))
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.BotToken)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call slack api: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK       bool           `json:"ok"`
		Error    string         `json:"error"`
		Messages []slackMessage `json:"messages"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return nil, fmt.Errorf("slack api error: %s", result.Error)
	}
	return result.Messages, nil
}

func (c *slackAPIClient) doSlackRequest(req *http.Request) error {
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("call slack api: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return fmt.Errorf("slack api error: %s", result.Error)
	}
	return nil
}
```

- [ ] **Step 4: Run tests**

Run: `cd services/holmes-relay/workspace && go test ./... -run TestSlackAPIClient -v`
Expected: PASS

- [ ] **Step 5: Write the failing test for the event handler**

`services/holmes-relay/workspace/slack_handler_test.go`:

```go
package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func signedRequest(t *testing.T, secret string, body []byte) *http.Request {
	t.Helper()
	tsStr := strconv.FormatInt(time.Now().Unix(), 10)
	req := httptest.NewRequest(http.MethodPost, "/slack/events", bytes.NewReader(body))
	req.Header.Set("X-Slack-Request-Timestamp", tsStr)
	req.Header.Set("X-Slack-Signature", sign(secret, tsStr, body))
	return req
}

func TestSlackHandler_URLVerification(t *testing.T) {
	secret := "sig-secret"
	body, _ := json.Marshal(map[string]string{
		"type":      "url_verification",
		"challenge": "abc123",
	})

	h := &slackHandler{cfg: Config{SlackSigningSecret: secret}}
	req := signedRequest(t, secret, body)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want %d", w.Code, http.StatusOK)
	}
	if w.Body.String() != "abc123" {
		t.Errorf("got body %q, want %q", w.Body.String(), "abc123")
	}
}

func TestSlackHandler_InvalidSignature(t *testing.T) {
	h := &slackHandler{cfg: Config{SlackSigningSecret: "sig-secret"}}
	req := httptest.NewRequest(http.MethodPost, "/slack/events", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("X-Slack-Request-Timestamp", strconv.FormatInt(time.Now().Unix(), 10))
	req.Header.Set("X-Slack-Signature", "v0=wrong")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestStripMentionUsedBySignHelper(t *testing.T) {
	// sanity check that the sign() helper from slack_verify_test.go is in scope
	if sign("s", "1", []byte("b")) == "" {
		t.Fatal("sign helper returned empty string")
	}
	_ = hmac.Equal
	_ = sha256.New
	_ = hex.EncodeToString
}
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd services/holmes-relay/workspace && go test ./... -run TestSlackHandler -v`
Expected: FAIL (`slackHandler` undefined)

- [ ] **Step 7: Implement the event handler**

`services/holmes-relay/workspace/slack_handler.go`:

```go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

type slackEventPayload struct {
	Type      string           `json:"type"`
	Challenge string           `json:"challenge,omitempty"`
	Event     *slackInnerEvent `json:"event,omitempty"`
}

type slackInnerEvent struct {
	Type     string `json:"type"`
	Channel  string `json:"channel"`
	User     string `json:"user"`
	Text     string `json:"text"`
	Ts       string `json:"ts"`
	ThreadTs string `json:"thread_ts,omitempty"`
}

type slackHandler struct {
	cfg    Config
	holmes *HolmesClient
	client *slackAPIClient
}

func (h *slackHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "cannot read body", http.StatusBadRequest)
		return
	}

	if err := verifySlackSignature(h.cfg.SlackSigningSecret, r.Header, body, time.Now()); err != nil {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	var payload slackEventPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	if payload.Type == "url_verification" {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(payload.Challenge))
		return
	}

	if payload.Type == "event_callback" && payload.Event != nil && payload.Event.Type == "app_mention" {
		w.WriteHeader(http.StatusOK)
		go h.handleMention(*payload.Event)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *slackHandler) handleMention(evt slackInnerEvent) {
	threadTs := evt.ThreadTs
	if threadTs == "" {
		threadTs = evt.Ts
	}

	ask := stripMention(evt.Text)

	if evt.ThreadTs != "" {
		history, err := h.client.ConversationsReplies(evt.Channel, evt.ThreadTs)
		if err != nil {
			log.Printf("failed to fetch thread history: %v", err)
		} else if len(history) > 0 {
			ask = buildAskWithHistory(history, ask)
		}
	}

	if err := h.client.PostMessage(evt.Channel, threadTs, "🔍 investigating..."); err != nil {
		log.Printf("failed to post ack message: %v", err)
	}

	analysis, err := h.holmes.Investigate(ask)
	if err != nil {
		if postErr := h.client.PostMessage(evt.Channel, threadTs, fmt.Sprintf("investigation failed: %v", err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if err := h.client.PostMessage(evt.Channel, threadTs, analysis); err != nil {
		log.Printf("failed to post analysis: %v", err)
	}
}
```

- [ ] **Step 8: Run tests**

Run: `cd services/holmes-relay/workspace && go test ./... -v`
Expected: PASS (all tests in the package, including Tasks 1-3)

- [ ] **Step 9: Wire the handler into main.go**

Replace `services/holmes-relay/workspace/main.go` with:

```go
package main

import (
	"log"
	"net/http"
)

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	holmes := NewHolmesClient(cfg.HolmesAPIURL, cfg.HolmesModel)
	slackClient := newSlackAPIClient(cfg.SlackBotToken)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/slack/events", &slackHandler{cfg: cfg, holmes: holmes, client: slackClient})

	addr := ":8080"
	log.Printf("holmes-relay listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 10: Build and test**

Run: `cd services/holmes-relay/workspace && go build ./... && go test ./... -v`
Expected: build succeeds, all tests PASS

- [ ] **Step 11: Commit**

```bash
git add services/holmes-relay/workspace/slack_api.go services/holmes-relay/workspace/slack_api_test.go services/holmes-relay/workspace/slack_handler.go services/holmes-relay/workspace/slack_handler_test.go services/holmes-relay/workspace/main.go
git commit -s -m "feat(holmes-relay): add Slack event handler with thread context"
```

---

## Task 5: Alertmanager webhook handler

**Files:**
- Create: `services/holmes-relay/workspace/alertmanager_handler.go`
- Create: `services/holmes-relay/workspace/alertmanager_handler_test.go`
- Modify: `services/holmes-relay/workspace/main.go`

**Interfaces:**
- Consumes: `HolmesClient.Investigate` (Task 2), `slackAPIClient.PostMessage` (Task 4), `Config` (Task 1).
- Produces: `type alertmanagerHandler struct { cfg Config; holmes *HolmesClient; client *slackAPIClient }` implementing `http.Handler`.

- [ ] **Step 1: Write the failing tests**

`services/holmes-relay/workspace/alertmanager_handler_test.go`:

```go
package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAlertmanagerHandler_Unauthorized(t *testing.T) {
	h := &alertmanagerHandler{cfg: Config{AlertmanagerToken: "secret-token"}}
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook?channel=test", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Authorization", "Bearer wrong-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestAlertmanagerHandler_MissingChannel(t *testing.T) {
	h := &alertmanagerHandler{cfg: Config{AlertmanagerToken: "secret-token"}}
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook", bytes.NewReader([]byte(`{"alerts":[]}`)))
	req.Header.Set("Authorization", "Bearer secret-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestAlertmanagerHandler_Accepted(t *testing.T) {
	// h.holmes and h.client must be real (non-nil) here: ServeHTTP spawns
	// investigateAlert in a goroutine, and a nil-pointer panic inside a
	// goroutine crashes the whole test binary, not just this test.
	posted := make(chan string, 1)

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(holmesChatResponse{Analysis: "found the cause"})
	}))
	defer holmesServer.Close()

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted <- body["text"]
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer slackServer.Close()

	slackClient := newSlackAPIClient("xoxb-test")
	slackClient.BaseURL = slackServer.URL

	h := &alertmanagerHandler{
		cfg:    Config{AlertmanagerToken: "secret-token"},
		holmes: NewHolmesClient(holmesServer.URL, "sonnet-4-6"),
		client: slackClient,
	}
	body := []byte(`{"alerts":[{"status":"firing","labels":{"alertname":"KubePodCrashLooping","severity":"critical"},"annotations":{"summary":"pod is crash looping"}}]}`)
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook?channel=incidents", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer secret-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want %d", w.Code, http.StatusOK)
	}

	select {
	case text := <-posted:
		if !strings.Contains(text, "found the cause") {
			t.Errorf("expected posted text to contain the analysis, got: %s", text)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for holmes-relay to post to Slack")
	}
}

func TestBuildAlertAsk(t *testing.T) {
	alert := alertmanagerAlert{
		Status:      "firing",
		Labels:      map[string]string{"alertname": "KubePodCrashLooping", "severity": "critical"},
		Annotations: map[string]string{"summary": "pod is crash looping"},
	}
	ask := buildAlertAsk(alert)
	if !strings.Contains(ask, "KubePodCrashLooping") {
		t.Errorf("expected alertname in ask, got: %s", ask)
	}
	if !strings.Contains(ask, "pod is crash looping") {
		t.Errorf("expected annotation in ask, got: %s", ask)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/holmes-relay/workspace && go test ./... -run "TestAlertmanagerHandler|TestBuildAlertAsk" -v`
Expected: FAIL (`alertmanagerHandler` undefined)

- [ ] **Step 3: Implement**

`services/holmes-relay/workspace/alertmanager_handler.go`:

```go
package main

import (
	"crypto/hmac"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

type alertmanagerWebhook struct {
	Status string              `json:"status"`
	Alerts []alertmanagerAlert `json:"alerts"`
}

type alertmanagerAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type alertmanagerHandler struct {
	cfg    Config
	holmes *HolmesClient
	client *slackAPIClient
}

func (h *alertmanagerHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	if !hmac.Equal([]byte(auth), []byte("Bearer "+h.cfg.AlertmanagerToken)) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	channel := r.URL.Query().Get("channel")
	if channel == "" {
		http.Error(w, "missing channel query parameter", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "cannot read body", http.StatusBadRequest)
		return
	}

	var payload alertmanagerWebhook
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)

	for _, alert := range payload.Alerts {
		if alert.Status != "firing" {
			continue
		}
		go h.investigateAlert(alert, channel)
	}
}

func (h *alertmanagerHandler) investigateAlert(alert alertmanagerAlert, channel string) {
	ask := buildAlertAsk(alert)

	analysis, err := h.holmes.Investigate(ask)
	if err != nil {
		if postErr := h.client.PostMessage(channel, "", fmt.Sprintf("investigation failed for alert %s: %v", alert.Labels["alertname"], err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if err := h.client.PostMessage(channel, "", fmt.Sprintf("*Alert: %s*\n%s", alert.Labels["alertname"], analysis)); err != nil {
		log.Printf("failed to post analysis: %v", err)
	}
}

func buildAlertAsk(alert alertmanagerAlert) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Investigate the following firing alert: %s\n", alert.Labels["alertname"]))
	b.WriteString("Labels:\n")
	for k, v := range alert.Labels {
		b.WriteString(fmt.Sprintf("- %s: %s\n", k, v))
	}
	b.WriteString("Annotations:\n")
	for k, v := range alert.Annotations {
		b.WriteString(fmt.Sprintf("- %s: %s\n", k, v))
	}
	return b.String()
}
```

- [ ] **Step 4: Run tests**

Run: `cd services/holmes-relay/workspace && go test ./... -v`
Expected: PASS (all tests, all tasks so far)

- [ ] **Step 5: Wire into main.go**

Add to `services/holmes-relay/workspace/main.go`, after the `mux.Handle("/slack/events", ...)` line:

```go
	mux.Handle("/alertmanager/webhook", &alertmanagerHandler{cfg: cfg, holmes: holmes, client: slackClient})
```

- [ ] **Step 6: Build and test**

Run: `cd services/holmes-relay/workspace && go build ./... && go test ./... -v`
Expected: build succeeds, all tests PASS

- [ ] **Step 7: Commit**

```bash
git add services/holmes-relay/workspace/alertmanager_handler.go services/holmes-relay/workspace/alertmanager_handler_test.go services/holmes-relay/workspace/main.go
git commit -s -m "feat(holmes-relay): add Alertmanager webhook handler"
```

---

## Task 6: Dockerfile

**Files:**
- Create: `services/holmes-relay/workspace/Dockerfile`
- Create: `services/holmes-relay/workspace/.dockerignore`

**Interfaces:**
- Consumes: the `main` package built in Tasks 1-5.
- Produces: a container image runnable locally, consumed by Task 7's Deployment manifest (`image: ghcr.io/panicboat/monorepo/holmes-relay:latest`, matching the CI-built tag convention used by `reusable--container-builder.yaml`).

- [ ] **Step 1: Write the Dockerfile**

`services/holmes-relay/workspace/Dockerfile`:

```dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o holmes-relay .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app/holmes-relay /holmes-relay
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/holmes-relay"]
```

- [ ] **Step 2: Write .dockerignore**

`services/holmes-relay/workspace/.dockerignore`:

```
*_test.go
```

- [ ] **Step 3: Build the image locally**

Run: `cd services/holmes-relay/workspace && docker build -t holmes-relay:local .`
Expected: build succeeds.

- [ ] **Step 4: Smoke-test the container**

```bash
docker run --rm -d --name holmes-relay-smoke -p 18080:8080 \
  -e SLACK_SIGNING_SECRET=test -e SLACK_BOT_TOKEN=test \
  -e ALERTMANAGER_SHARED_TOKEN=test -e HOLMES_API_URL=http://example.invalid \
  holmes-relay:local
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:18080/healthz
docker stop holmes-relay-smoke
```

Expected: prints `200`.

- [ ] **Step 5: Commit**

```bash
git add services/holmes-relay/workspace/Dockerfile services/holmes-relay/workspace/.dockerignore
git commit -s -m "feat(holmes-relay): add Dockerfile"
```

---

## Task 7: Kubernetes manifests

**Files:**
- Create: `services/holmes-relay/kubernetes/base/deployment.yaml`
- Create: `services/holmes-relay/kubernetes/base/service.yaml`
- Create: `services/holmes-relay/kubernetes/base/configmap.yaml`
- Create: `services/holmes-relay/kubernetes/base/httproute.yaml`
- Create: `services/holmes-relay/kubernetes/base/kustomization.yaml`
- Create: `services/holmes-relay/kubernetes/overlays/production/deployment.yaml`
- Create: `services/holmes-relay/kubernetes/overlays/production/kustomization.yaml`

**Interfaces:**
- Consumes: the container image built in Task 6 (`ghcr.io/panicboat/monorepo/holmes-relay`), the ExternalSecret names produced by Task 8 (`holmes-relay-slack`, `holmes-relay-alertmanager`).
- Produces: a Deployment/Service/HTTPRoute set matching the `services/frontend` pattern, ready for Flux to apply.

- [ ] **Step 1: Write the base ConfigMap**

`services/holmes-relay/kubernetes/base/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: holmes-relay
data:
  HOLMES_API_URL: http://holmesgpt-holmes.holmesgpt.svc.cluster.local
  HOLMES_MODEL: sonnet-4-6
```

- [ ] **Step 2: Write the base Deployment**

`services/holmes-relay/kubernetes/base/deployment.yaml`:

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

- [ ] **Step 3: Write the base Service**

`services/holmes-relay/kubernetes/base/service.yaml`:

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

- [ ] **Step 4: Write the base HTTPRoute**

`services/holmes-relay/kubernetes/base/httproute.yaml`:

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

- [ ] **Step 5: Write the base kustomization**

`services/holmes-relay/kubernetes/base/kustomization.yaml`:

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

- [ ] **Step 6: Write the production overlay deployment patch**

`services/holmes-relay/kubernetes/overlays/production/deployment.yaml`:

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

- [ ] **Step 7: Write the production overlay kustomization**

`services/holmes-relay/kubernetes/overlays/production/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
  - external-secret.yaml
patches:
  - path: deployment.yaml
```

Note: `external-secret.yaml` is created in Task 8 — this kustomization will not build until Task 8 is complete.

- [ ] **Step 8: Validate the base manifests build**

Run: `cd services/holmes-relay/kubernetes/base && kustomize build .`
Expected: valid YAML output for ConfigMap, Deployment, Service, HTTPRoute — no errors. (The overlay cannot be validated yet; Task 8 adds the missing `external-secret.yaml` resource.)

- [ ] **Step 9: Commit**

```bash
git add services/holmes-relay/kubernetes
git commit -s -m "feat(holmes-relay): add Kubernetes base and production overlay manifests"
```

---

## Task 8: Terragrunt secret scaffolding and manual setup docs

**Files:**
- Create: `services/holmes-relay/terragrunt/root.hcl`
- Create: `services/holmes-relay/terragrunt/modules/main.tf`
- Create: `services/holmes-relay/terragrunt/modules/variables.tf`
- Create: `services/holmes-relay/terragrunt/modules/outputs.tf`
- Create: `services/holmes-relay/terragrunt/envs/production/terragrunt.hcl`
- Create: `services/holmes-relay/terragrunt/envs/production/env.hcl`
- Create: `services/holmes-relay/kubernetes/overlays/production/external-secret.yaml`
- Create: `services/holmes-relay/README.md`

**Interfaces:**
- Produces: two AWS Secrets Manager secrets (`panicboat/holmes-relay/slack`, `panicboat/holmes-relay/alertmanager`) and the ExternalSecret resources that sync them into the `holmes-relay-slack` / `holmes-relay-alertmanager` K8s Secrets referenced by Task 7's Deployment.

- [ ] **Step 1: Copy the shared root.hcl**

```bash
cp services/monolith/terragrunt/root.hcl services/holmes-relay/terragrunt/root.hcl
```

This file is copy-pasted per-service in this monorepo (confirmed by comparing `services/monolith/terragrunt/root.hcl`, which is identical boilerplate). Its `remote_state.config.key` value is always overridden by each service's own `envs/<env>/terragrunt.hcl`, so no edits are needed here.

- [ ] **Step 2: Write the Terraform module**

`services/holmes-relay/terragrunt/modules/variables.tf`:

```hcl
variable "environment" {
  type        = string
  description = "Environment name (= develop / staging / production)"
}

variable "common_tags" {
  type        = map(string)
  description = "Common resource tags"
  default     = {}
}
```

`services/holmes-relay/terragrunt/modules/main.tf`:

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

`services/holmes-relay/terragrunt/modules/outputs.tf`:

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

- [ ] **Step 3: Write the production environment config**

`services/holmes-relay/terragrunt/envs/production/env.hcl`:

```hcl
locals {
  environment = "production"
  aws_region  = "ap-northeast-1"
  additional_tags = {
    CostCenter = "production"
    Owner      = "panicboat"
    Purpose    = "holmes-relay"
  }
}
```

`services/holmes-relay/terragrunt/envs/production/terragrunt.hcl`:

```hcl
include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path   = "env.hcl"
  expose = true
}

terraform {
  source = "../../modules"
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "terragrunt-state-${get_aws_account_id()}"
    key            = "services/holmes-relay/${include.env.locals.environment}/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "terragrunt-state-locks"
    encrypt        = true
  }
}

inputs = {
  environment = include.env.locals.environment
  common_tags = merge(
    {
      Environment = include.env.locals.environment
    },
    include.env.locals.additional_tags
  )
}
```

- [ ] **Step 4: Validate the Terragrunt plan**

Run: `cd services/holmes-relay/terragrunt/envs/production && terragrunt plan`
Expected: plan succeeds, shows 2 resources to add (`aws_secretsmanager_secret.holmes_relay_slack`, `aws_secretsmanager_secret.holmes_relay_alertmanager`), no errors.

- [ ] **Step 5: Write the ExternalSecret manifests**

`services/holmes-relay/kubernetes/overlays/production/external-secret.yaml`:

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

- [ ] **Step 6: Validate the full production overlay now builds**

Run: `cd services/holmes-relay/kubernetes/overlays/production && kustomize build .`
Expected: valid YAML output including both ExternalSecret resources — no errors. This confirms Task 7's overlay (which referenced `external-secret.yaml` before it existed) is now complete.

- [ ] **Step 7: Write the service README**

`services/holmes-relay/README.md`:

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

- [ ] **Step 8: Commit**

```bash
git add services/holmes-relay/terragrunt services/holmes-relay/kubernetes/overlays/production/external-secret.yaml services/holmes-relay/README.md
git commit -s -m "feat(holmes-relay): add Terragrunt secret scaffolding and setup docs"
```

---

## Task 9: Open Draft PR

**Files:** none (git/GitHub operations only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/holmes-relay
```

- [ ] **Step 2: Open a Draft PR**

```bash
gh pr create --draft --title "feat(holmes-relay): add Slack/Alertmanager relay service for HolmesGPT" --body "$(cat <<'EOF'
## Summary
- New service `services/holmes-relay/`: relays Slack @mentions and Alertmanager critical alerts to HolmesGPT's /api/chat, posting results back to Slack.
- No third-party Go dependencies (stdlib only).
- Terragrunt scaffolding for the two required Secrets Manager secrets (values provisioned manually post-merge, per services/monolith's existing pattern).

## Test plan
- [ ] `go test ./...` passes in `services/holmes-relay/workspace`
- [ ] `docker build` succeeds and `/healthz` responds 200
- [ ] `kustomize build` succeeds for both base and production overlay
- [ ] `terragrunt plan` succeeds for the production secrets module
- [ ] After merge: provision secret values, create the Slack app, verify a real `@holmes` mention gets a threaded reply

Design: docs/superpowers/specs/2026-08-14-holmes-relay-design.md (panicboat/platform repo)
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Self-Review Notes

- **Spec coverage**: Slack mention UX + thread context (Tasks 3-4), Alertmanager `severity:critical` + channel-via-query-param (Task 5, receiver-side filtering is out of this plan's scope — see the platform-repo plan), async 3s-ACK handling (Task 4 Step 7), Secrets Manager + ExternalSecret pattern (Task 8), manual Slack app setup steps (Task 8 README) are all covered. The design's "NetworkPolicy as future consideration" and "sonnet-5 quota" items are intentionally left as open items, not tasks, per the spec's own "Open Items" section.
- **Placeholder scan**: no TBD/TODO markers; all code blocks are complete and self-contained.
- **Type consistency**: `slackMessage` (Task 3) is reused as-is by `slack_api.go` (Task 4) and matches the JSON shape returned by Slack's `conversations.replies`. `Config` fields (Task 1) are consumed identically by `slackHandler` and `alertmanagerHandler` (Tasks 4-5). `HolmesClient.Investigate(string) (string, error)` (Task 2) signature is used identically in both handlers.
