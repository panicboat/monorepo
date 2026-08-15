# holmes Package Layout Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `system-components/holmes/workspace/`'s flat `package main` into `internal/config`, `internal/clients/{holmes,slack}`, `internal/handlers/{slack,alertmanager}`, with handlers depending on consumer-defined interfaces instead of concrete client types — no behavior change.

**Architecture:** Incremental migration. Tasks 1-5 each create one new package alongside the existing flat files (both coexist and build/test independently — nothing imports the new packages yet, so the running app is unaffected). Task 6 is the single cutover: delete the 12 old flat files, rewrite `main.go` to wire the new packages together, and verify the whole thing still builds and passes every test. This keeps each task's diff small and independently reviewable while guaranteeing the app never sits in a half-migrated, non-building state.

**Tech Stack:** Go 1.24, stdlib only (no third-party dependencies — same constraint as the original build).

## Global Constraints

- No third-party Go dependencies — stdlib only.
- No behavior change anywhere — every rename is mechanical (moved code + renamed identifiers only). Any step that isn't a pure rename is called out explicitly in that step.
- Module path: `github.com/panicboat/monorepo/system-components/holmes` (already set, from the separate move-and-rename PR). `go.mod`'s `go 1.24` line is not touched by this plan.
- Import alias convention: `internal/clients/slack` is imported as `slackclient` and `internal/clients/holmes` as `holmesclient` everywhere they're imported alongside another package that would otherwise collide or read ambiguously (both `internal/handlers/slack` and `main` import them this way). `internal/handlers/alertmanager` and `internal/handlers/slack` are imported unaliased as `alertmanager`/`slackhandler` from `main.go` (only `slackhandler` needs the alias, since `internal/clients/slack`'s package name is also literally `slack`).
- Design doc: `docs/superpowers/specs/2026-08-15-holmes-relay-packages-design.md`.

---

## Task 1: internal/config package

**Files:**
- Create: `system-components/holmes/workspace/internal/config/config.go`
- Create: `system-components/holmes/workspace/internal/config/config_test.go`

**Interfaces:**
- Produces: `type Config struct { SlackSigningSecret, SlackBotToken, AlertmanagerToken, HolmesAPIURL, HolmesModel string }`, `func Load() (Config, error)` — consumed by every later task's `Handler` (`Cfg config.Config` field) and by Task 6's `main.go`.

- [ ] **Step 1: Write the failing test**

`system-components/holmes/workspace/internal/config/config_test.go`:

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

func TestLoad_MissingRequired(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "HOLMES_API_URL", "http://example.invalid")

	if _, err := Load(); err == nil {
		t.Fatal("expected error when SLACK_SIGNING_SECRET is missing, got nil")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd system-components/holmes/workspace && mkdir -p internal/config && go test ./internal/config/... -v`
Expected: FAIL (`Load` undefined)

- [ ] **Step 3: Write the implementation**

`system-components/holmes/workspace/internal/config/config.go`:

```go
package config

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

- [ ] **Step 4: Run tests and confirm the whole module still builds**

Run: `cd system-components/holmes/workspace && go build ./... && go test ./... -v -race -count=1 && gofmt -l .`
Expected: build succeeds (old flat `config.go` at the workspace root is untouched and still compiles as `package main` — it coexists with the new `internal/config` package since they're different packages in different directories), all tests PASS (both the old root-level tests and the two new ones), `gofmt -l .` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/workspace/internal/config
git commit -s -m "feat(holmes): add internal/config package"
```

---

## Task 2: internal/clients/holmes package

**Files:**
- Create: `system-components/holmes/workspace/internal/clients/holmes/client.go`
- Create: `system-components/holmes/workspace/internal/clients/holmes/client_test.go`

**Interfaces:**
- Produces: `type Client struct { BaseURL, Model string; HTTPClient *http.Client }`, `func New(baseURL, model string) *Client`, `func (c *Client) Investigate(ask string) (string, error)` — consumed by Task 6's `main.go` (constructs the concrete client) and by Tasks 4-5's test files (which need a real client to drive httptest-based tests).

- [ ] **Step 1: Write the failing test**

`system-components/holmes/workspace/internal/clients/holmes/client_test.go`:

```go
package holmes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClient_Investigate(t *testing.T) {
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

	client := New(server.URL, "sonnet-4-6")
	analysis, err := client.Investigate("why is pod crashing")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if analysis != "root cause found" {
		t.Errorf("got %q, want %q", analysis, "root cause found")
	}
}

func TestClient_Investigate_ErrorStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := New(server.URL, "sonnet-4-6")
	if _, err := client.Investigate("test"); err == nil {
		t.Fatal("expected error, got nil")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd system-components/holmes/workspace && mkdir -p internal/clients/holmes && go test ./internal/clients/holmes/... -v`
Expected: FAIL (`New` undefined)

- [ ] **Step 3: Write the implementation**

`system-components/holmes/workspace/internal/clients/holmes/client.go`:

```go
package holmes

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	BaseURL    string
	Model      string
	HTTPClient *http.Client
}

func New(baseURL, model string) *Client {
	return &Client{
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

func (c *Client) Investigate(ask string) (string, error) {
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

- [ ] **Step 4: Run tests and confirm the whole module still builds**

Run: `cd system-components/holmes/workspace && go build ./... && go test ./... -v -race -count=1 && gofmt -l .`
Expected: build succeeds, all tests PASS, `gofmt -l .` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/workspace/internal/clients/holmes
git commit -s -m "feat(holmes): add internal/clients/holmes package"
```

---

## Task 3: internal/clients/slack package

**Files:**
- Create: `system-components/holmes/workspace/internal/clients/slack/verify.go`
- Create: `system-components/holmes/workspace/internal/clients/slack/verify_test.go`
- Create: `system-components/holmes/workspace/internal/clients/slack/api.go`
- Create: `system-components/holmes/workspace/internal/clients/slack/api_test.go`

**Interfaces:**
- Produces: `func VerifySignature(signingSecret string, header http.Header, body []byte, now time.Time) error`, `func StripMention(text string) string`, `type Message struct { Text, User, Ts string }`, `func BuildAskWithHistory(history []Message, ask string) string`, `type Client struct { BotToken, BaseURL string; HTTPClient *http.Client }`, `func New(botToken string) *Client`, `func (c *Client) PostMessage(channel, threadTs, text string) error`, `func (c *Client) ConversationsReplies(channel, threadTs string) ([]Message, error)` — all consumed by Task 4 (`internal/handlers/slack`) and Task 6 (`main.go`).

- [ ] **Step 1: Write the failing tests for signature verification and mention parsing**

`system-components/holmes/workspace/internal/clients/slack/verify_test.go`:

```go
package slack

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

func TestVerifySignature_Valid(t *testing.T) {
	secret := "test-signing-secret"
	body := []byte(`{"type":"url_verification","challenge":"abc"}`)
	now := time.Now()
	tsStr := strconv.FormatInt(now.Unix(), 10)

	header := http.Header{}
	header.Set("X-Slack-Request-Timestamp", tsStr)
	header.Set("X-Slack-Signature", sign(secret, tsStr, body))

	if err := VerifySignature(secret, header, body, now); err != nil {
		t.Fatalf("expected valid signature, got error: %v", err)
	}
}

func TestVerifySignature_Invalid(t *testing.T) {
	header := http.Header{}
	header.Set("X-Slack-Request-Timestamp", strconv.FormatInt(time.Now().Unix(), 10))
	header.Set("X-Slack-Signature", "v0=deadbeef")

	if err := VerifySignature("secret", header, []byte("body"), time.Now()); err == nil {
		t.Fatal("expected error for invalid signature, got nil")
	}
}

func TestVerifySignature_TooOld(t *testing.T) {
	secret := "test-signing-secret"
	body := []byte("body")
	old := time.Now().Add(-10 * time.Minute)
	tsStr := strconv.FormatInt(old.Unix(), 10)

	header := http.Header{}
	header.Set("X-Slack-Request-Timestamp", tsStr)
	header.Set("X-Slack-Signature", sign(secret, tsStr, body))

	if err := VerifySignature(secret, header, body, time.Now()); err == nil {
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
		if got := StripMention(input); got != want {
			t.Errorf("StripMention(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestBuildAskWithHistory(t *testing.T) {
	history := []Message{
		{Text: "frontend pods are crashlooping", User: "U1"},
		{Text: "started 10 minutes ago", User: "U1"},
	}
	got := BuildAskWithHistory(history, "what's the root cause?")
	if !strings.Contains(got, "frontend pods are crashlooping") {
		t.Errorf("expected history text in result, got: %s", got)
	}
	if !strings.Contains(got, "what's the root cause?") {
		t.Errorf("expected ask text in result, got: %s", got)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd system-components/holmes/workspace && mkdir -p internal/clients/slack && go test ./internal/clients/slack/... -v`
Expected: FAIL (`VerifySignature` undefined)

- [ ] **Step 3: Write verify.go**

`system-components/holmes/workspace/internal/clients/slack/verify.go`:

```go
package slack

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

func VerifySignature(signingSecret string, header http.Header, body []byte, now time.Time) error {
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

func StripMention(text string) string {
	return strings.TrimSpace(mentionPrefix.ReplaceAllString(text, ""))
}

type Message struct {
	Text string `json:"text"`
	User string `json:"user"`
	Ts   string `json:"ts"`
}

func BuildAskWithHistory(history []Message, ask string) string {
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/slack/... -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing tests for the Slack API client**

`system-components/holmes/workspace/internal/clients/slack/api_test.go`:

```go
package slack

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClient_PostMessage(t *testing.T) {
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

	c := New("xoxb-test")
	c.BaseURL = server.URL
	if err := c.PostMessage("C123", "T123", "hello"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotBody["channel"] != "C123" || gotBody["thread_ts"] != "T123" || gotBody["text"] != "hello" {
		t.Errorf("unexpected body: %+v", gotBody)
	}
}

func TestClient_PostMessage_NoThread(t *testing.T) {
	var gotBody map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&gotBody)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()

	c := New("xoxb-test")
	c.BaseURL = server.URL
	if err := c.PostMessage("C123", "", "hello"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, present := gotBody["thread_ts"]; present {
		t.Errorf("expected no thread_ts key when threadTs is empty, got: %+v", gotBody)
	}
}

func TestClient_ConversationsReplies(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/conversations.replies" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"messages": []Message{
				{Text: "first message", User: "U1", Ts: "1"},
				{Text: "second message", User: "U2", Ts: "2"},
			},
		})
	}))
	defer server.Close()

	c := New("xoxb-test")
	c.BaseURL = server.URL
	msgs, err := c.ConversationsReplies("C123", "1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(msgs))
	}
}

func TestClient_PostMessage_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "channel_not_found"})
	}))
	defer server.Close()

	c := New("xoxb-test")
	c.BaseURL = server.URL
	if err := c.PostMessage("C123", "", "hello"); err == nil {
		t.Fatal("expected error, got nil")
	}
}
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/slack/... -run TestClient -v`
Expected: FAIL (`New` undefined)

- [ ] **Step 7: Write api.go**

`system-components/holmes/workspace/internal/clients/slack/api.go`:

```go
package slack

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	neturl "net/url"
	"time"
)

type Client struct {
	BotToken   string
	BaseURL    string
	HTTPClient *http.Client
}

func New(botToken string) *Client {
	return &Client{
		BotToken:   botToken,
		BaseURL:    "https://slack.com/api",
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) PostMessage(channel, threadTs, text string) error {
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

func (c *Client) ConversationsReplies(channel, threadTs string) ([]Message, error) {
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
		OK       bool      `json:"ok"`
		Error    string    `json:"error"`
		Messages []Message `json:"messages"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return nil, fmt.Errorf("slack api error: %s", result.Error)
	}
	return result.Messages, nil
}

func (c *Client) doSlackRequest(req *http.Request) error {
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

- [ ] **Step 8: Run tests and confirm the whole module still builds**

Run: `cd system-components/holmes/workspace && go build ./... && go test ./... -v -race -count=1 && gofmt -l .`
Expected: build succeeds, all tests PASS (9 tests in this package plus everything from Tasks 1-2 and the still-untouched flat files), `gofmt -l .` prints nothing.

- [ ] **Step 9: Commit**

```bash
git add system-components/holmes/workspace/internal/clients/slack
git commit -s -m "feat(holmes): add internal/clients/slack package"
```

---

## Task 4: internal/handlers/slack package

**Files:**
- Create: `system-components/holmes/workspace/internal/handlers/slack/handler.go`
- Create: `system-components/holmes/workspace/internal/handlers/slack/handler_test.go`

**Interfaces:**
- Consumes: `config.Config` (Task 1), `slackclient.VerifySignature`/`StripMention`/`Message`/`BuildAskWithHistory`/`Client`/`New` (Task 3, import path `.../internal/clients/slack`, aliased `slackclient`), `holmesclient.Client`/`New` (Task 2, import path `.../internal/clients/holmes`, aliased `holmesclient`, test-only — production code never names the concrete type, only the `investigator` interface).
- Produces: `type Handler struct { Cfg config.Config; Holmes investigator; Client messagePoster }` implementing `http.Handler` — consumed by Task 6's `main.go`.

- [ ] **Step 1: Write the failing tests**

`system-components/holmes/workspace/internal/handlers/slack/handler_test.go`:

```go
package slack

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	holmesclient "github.com/panicboat/monorepo/system-components/holmes/internal/clients/holmes"
	slackclient "github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
)

func sign(secret, tsStr string, body []byte) string {
	baseString := "v0:" + tsStr + ":" + string(body)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(baseString))
	return "v0=" + hex.EncodeToString(mac.Sum(nil))
}

func signedRequest(t *testing.T, secret string, body []byte) *http.Request {
	t.Helper()
	tsStr := strconv.FormatInt(time.Now().Unix(), 10)
	req := httptest.NewRequest(http.MethodPost, "/slack/events", bytes.NewReader(body))
	req.Header.Set("X-Slack-Request-Timestamp", tsStr)
	req.Header.Set("X-Slack-Signature", sign(secret, tsStr, body))
	return req
}

func TestHandler_URLVerification(t *testing.T) {
	secret := "sig-secret"
	body, _ := json.Marshal(map[string]string{
		"type":      "url_verification",
		"challenge": "abc123",
	})

	h := &Handler{Cfg: config.Config{SlackSigningSecret: secret}}
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

func TestHandler_InvalidSignature(t *testing.T) {
	h := &Handler{Cfg: config.Config{SlackSigningSecret: "sig-secret"}}
	req := httptest.NewRequest(http.MethodPost, "/slack/events", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("X-Slack-Request-Timestamp", strconv.FormatInt(time.Now().Unix(), 10))
	req.Header.Set("X-Slack-Signature", "v0=wrong")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestHandleMention_TopLevelMention(t *testing.T) {
	var posted []map[string]string
	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chat.postMessage":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		case "/conversations.replies":
			t.Errorf("conversations.replies should not be called for a top-level mention")
		default:
			t.Errorf("unexpected slack path: %s", r.URL.Path)
		}
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"analysis": "root cause found"})
	}))
	defer holmesServer.Close()

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: &slackclient.Client{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
	}

	evt := slackInnerEvent{
		Type:    "app_mention",
		Channel: "C123",
		User:    "U1",
		Text:    "<@BOT> investigate the frontend",
		Ts:      "100.001",
	}

	h.handleMention(evt)

	if len(posted) < 2 {
		t.Fatalf("expected at least 2 posted messages (ack + result), got %d: %+v", len(posted), posted)
	}
	final := posted[len(posted)-1]
	if final["thread_ts"] != "100.001" {
		t.Errorf("expected final post thread_ts=%q (evt.Ts), got %q", "100.001", final["thread_ts"])
	}
	if final["text"] != "root cause found" {
		t.Errorf("expected final post text=%q, got %q", "root cause found", final["text"])
	}
}

func TestHandleMention_ThreadHistory(t *testing.T) {
	var repliesCalled bool
	var posted []map[string]string
	var gotAsk string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/conversations.replies":
			repliesCalled = true
			json.NewEncoder(w).Encode(map[string]any{
				"ok": true,
				"messages": []slackclient.Message{
					{Text: "frontend pods are crashlooping", User: "U1", Ts: "50"},
				},
			})
		case "/chat.postMessage":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			t.Errorf("unexpected slack path: %s", r.URL.Path)
		}
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]string
		json.NewDecoder(r.Body).Decode(&req)
		gotAsk = req["ask"]
		json.NewEncoder(w).Encode(map[string]string{"analysis": "likely OOMKilled"})
	}))
	defer holmesServer.Close()

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: &slackclient.Client{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
	}

	evt := slackInnerEvent{
		Type:     "app_mention",
		Channel:  "C123",
		User:     "U1",
		Text:     "<@BOT> what's the root cause?",
		Ts:       "60",
		ThreadTs: "50",
	}

	h.handleMention(evt)

	if !repliesCalled {
		t.Fatal("expected conversations.replies to be called for a threaded mention")
	}
	if !strings.Contains(gotAsk, "frontend pods are crashlooping") {
		t.Errorf("expected ask sent to holmes to include thread history, got: %q", gotAsk)
	}
	if len(posted) < 2 {
		t.Fatalf("expected at least 2 posted messages, got %d: %+v", len(posted), posted)
	}
	final := posted[len(posted)-1]
	if final["thread_ts"] != "50" {
		t.Errorf("expected final post thread_ts=%q (evt.ThreadTs), got %q", "50", final["thread_ts"])
	}
}

func TestHandleMention_ConversationsRepliesFailure(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/conversations.replies":
			w.WriteHeader(http.StatusInternalServerError)
		case "/chat.postMessage":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			t.Errorf("unexpected slack path: %s", r.URL.Path)
		}
	}))
	defer slackServer.Close()

	var holmesCalled bool
	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		holmesCalled = true
		json.NewEncoder(w).Encode(map[string]string{"analysis": "investigated anyway"})
	}))
	defer holmesServer.Close()

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: &slackclient.Client{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
	}

	evt := slackInnerEvent{
		Type:     "app_mention",
		Channel:  "C123",
		User:     "U1",
		Text:     "<@BOT> what's going on?",
		Ts:       "60",
		ThreadTs: "50",
	}

	h.handleMention(evt)

	if !holmesCalled {
		t.Fatal("expected the investigation to proceed despite the conversations.replies failure")
	}
	if len(posted) < 2 {
		t.Fatalf("expected at least 2 posted messages despite the conversations.replies failure, got %d: %+v", len(posted), posted)
	}
	final := posted[len(posted)-1]
	if final["text"] != "investigated anyway" {
		t.Errorf("expected the investigation result to still be posted, got: %+v", final)
	}
}

func TestHandleMention_InvestigateFailure(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chat.postMessage":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			t.Errorf("unexpected slack path: %s", r.URL.Path)
		}
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer holmesServer.Close()

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: &slackclient.Client{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
	}

	evt := slackInnerEvent{
		Type:    "app_mention",
		Channel: "C123",
		User:    "U1",
		Text:    "<@BOT> investigate this",
		Ts:      "100",
	}

	h.handleMention(evt)

	if len(posted) < 2 {
		t.Fatalf("expected at least 2 posted messages (ack + failure), got %d: %+v", len(posted), posted)
	}
	final := posted[len(posted)-1]
	if !strings.Contains(final["text"], "investigation failed") {
		t.Errorf("expected a failure message to be posted, got: %+v", final)
	}
}
```

Note: this test file intentionally does NOT include an equivalent of the old `TestStripMentionUsedBySignHelper` test — that test only existed to sanity-check that the flat package's `sign()` helper (defined in a sibling `_test.go` file) was in scope, a concern specific to the old single-package layout. It has no purpose once `sign()` is duplicated locally in this file (Step 1 above) and provides no coverage of production behavior; carrying it forward would just be dead weight.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd system-components/holmes/workspace && mkdir -p internal/handlers/slack && go test ./internal/handlers/slack/... -v`
Expected: FAIL (`Handler`/`slackInnerEvent` undefined)

- [ ] **Step 3: Write the implementation**

`system-components/holmes/workspace/internal/handlers/slack/handler.go`:

```go
package slack

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	slackclient "github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
)

type investigator interface {
	Investigate(ask string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) error
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
}

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

type Handler struct {
	Cfg    config.Config
	Holmes investigator
	Client messagePoster
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "cannot read body", http.StatusBadRequest)
		return
	}

	if err := slackclient.VerifySignature(h.Cfg.SlackSigningSecret, r.Header, body, time.Now()); err != nil {
		log.Printf("slack signature verification failed: %v", err)
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

	if err := h.Client.PostMessage(evt.Channel, threadTs, "🔍 investigating..."); err != nil {
		log.Printf("failed to post ack message: %v", err)
	}

	analysis, err := h.Holmes.Investigate(ask)
	if err != nil {
		if postErr := h.Client.PostMessage(evt.Channel, threadTs, fmt.Sprintf("investigation failed: %v", err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if err := h.Client.PostMessage(evt.Channel, threadTs, analysis); err != nil {
		log.Printf("failed to post analysis: %v", err)
	}
}
```

- [ ] **Step 4: Run tests and confirm the whole module still builds**

Run: `cd system-components/holmes/workspace && go build ./... && go test ./... -v -race -count=1 && gofmt -l .`
Expected: build succeeds, all tests PASS, `gofmt -l .` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/workspace/internal/handlers/slack
git commit -s -m "feat(holmes): add internal/handlers/slack package"
```

---

## Task 5: internal/handlers/alertmanager package

**Files:**
- Create: `system-components/holmes/workspace/internal/handlers/alertmanager/handler.go`
- Create: `system-components/holmes/workspace/internal/handlers/alertmanager/handler_test.go`

**Interfaces:**
- Consumes: `config.Config` (Task 1), `holmesclient.New` (Task 2, test-only), `slackclient.New` (Task 3, test-only).
- Produces: `type Handler struct { Cfg config.Config; Holmes investigator; Client messagePoster }` implementing `http.Handler` — consumed by Task 6's `main.go`.

- [ ] **Step 1: Write the failing tests**

`system-components/holmes/workspace/internal/handlers/alertmanager/handler_test.go`:

```go
package alertmanager

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	holmesclient "github.com/panicboat/monorepo/system-components/holmes/internal/clients/holmes"
	slackclient "github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
)

func TestHandler_Unauthorized(t *testing.T) {
	h := &Handler{Cfg: config.Config{AlertmanagerToken: "secret-token"}}
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook?channel=test", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Authorization", "Bearer wrong-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestHandler_MissingChannel(t *testing.T) {
	h := &Handler{Cfg: config.Config{AlertmanagerToken: "secret-token"}}
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook", bytes.NewReader([]byte(`{"alerts":[]}`)))
	req.Header.Set("Authorization", "Bearer secret-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandler_Accepted(t *testing.T) {
	// h.Holmes and h.Client must be real (non-nil) here: ServeHTTP spawns
	// investigateAlert in a goroutine, and a nil-pointer panic inside a
	// goroutine crashes the whole test binary, not just this test.
	posted := make(chan string, 1)

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"analysis": "found the cause"})
	}))
	defer holmesServer.Close()

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted <- body["text"]
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer slackServer.Close()

	slackClient := slackclient.New("xoxb-test")
	slackClient.BaseURL = slackServer.URL

	h := &Handler{
		Cfg:    config.Config{AlertmanagerToken: "secret-token"},
		Holmes: holmesclient.New(holmesServer.URL, "sonnet-4-6"),
		Client: slackClient,
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
		t.Fatal("timed out waiting for holmes to post to Slack")
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

Note: unlike the old flat-package `alertmanager_handler_test.go`, `TestHandler_Accepted` fakes the Holmes server's response with `map[string]string{"analysis": "found the cause"}` instead of the unexported `holmesChatResponse{Analysis: "found the cause"}` struct — that type now lives in `internal/clients/holmes` and is unexported, so it isn't reachable from this package. The JSON shape is identical (`{"analysis": "..."}`), so this is a pure mechanical substitution with no behavior change; the sibling `internal/handlers/slack` tests already use this same map-literal pattern for their fake Holmes responses.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd system-components/holmes/workspace && mkdir -p internal/handlers/alertmanager && go test ./internal/handlers/alertmanager/... -v`
Expected: FAIL (`Handler`/`alertmanagerAlert`/`buildAlertAsk` undefined)

- [ ] **Step 3: Write the implementation**

`system-components/holmes/workspace/internal/handlers/alertmanager/handler.go`:

```go
package alertmanager

import (
	"crypto/hmac"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
)

type investigator interface {
	Investigate(ask string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) error
}

type alertmanagerWebhook struct {
	Status string              `json:"status"`
	Alerts []alertmanagerAlert `json:"alerts"`
}

type alertmanagerAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type Handler struct {
	Cfg    config.Config
	Holmes investigator
	Client messagePoster
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	if !hmac.Equal([]byte(auth), []byte("Bearer "+h.Cfg.AlertmanagerToken)) {
		log.Printf("alertmanager auth token rejected")
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

func (h *Handler) investigateAlert(alert alertmanagerAlert, channel string) {
	ask := buildAlertAsk(alert)

	analysis, err := h.Holmes.Investigate(ask)
	if err != nil {
		if postErr := h.Client.PostMessage(channel, "", fmt.Sprintf("investigation failed for alert %s: %v", alert.Labels["alertname"], err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if err := h.Client.PostMessage(channel, "", fmt.Sprintf("*Alert: %s*\n%s", alert.Labels["alertname"], analysis)); err != nil {
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

- [ ] **Step 4: Run tests and confirm the whole module still builds**

Run: `cd system-components/holmes/workspace && go build ./... && go test ./... -v -race -count=1 && gofmt -l .`
Expected: build succeeds, all tests PASS, `gofmt -l .` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/workspace/internal/handlers/alertmanager
git commit -s -m "feat(holmes): add internal/handlers/alertmanager package"
```

---

## Task 6: Cut over main.go and delete the old flat files

**Files:**
- Modify: `system-components/holmes/workspace/main.go`
- Delete: `system-components/holmes/workspace/config.go`
- Delete: `system-components/holmes/workspace/config_test.go`
- Delete: `system-components/holmes/workspace/holmes.go`
- Delete: `system-components/holmes/workspace/holmes_test.go`
- Delete: `system-components/holmes/workspace/slack_verify.go`
- Delete: `system-components/holmes/workspace/slack_verify_test.go`
- Delete: `system-components/holmes/workspace/slack_api.go`
- Delete: `system-components/holmes/workspace/slack_api_test.go`
- Delete: `system-components/holmes/workspace/slack_handler.go`
- Delete: `system-components/holmes/workspace/slack_handler_test.go`
- Delete: `system-components/holmes/workspace/alertmanager_handler.go`
- Delete: `system-components/holmes/workspace/alertmanager_handler_test.go`

**Interfaces:**
- Consumes: everything produced by Tasks 1-5 (`config.Load`, `holmes.New`, `slack.New`, `slackhandler.Handler`, `alertmanager.Handler`).
- Produces: the final, fully-migrated `main` package — nothing later depends on this.

- [ ] **Step 1: Delete the twelve superseded flat files**

```bash
cd system-components/holmes/workspace
rm config.go config_test.go holmes.go holmes_test.go \
   slack_verify.go slack_verify_test.go slack_api.go slack_api_test.go \
   slack_handler.go slack_handler_test.go \
   alertmanager_handler.go alertmanager_handler_test.go
```

- [ ] **Step 2: Rewrite main.go**

Replace `system-components/holmes/workspace/main.go` entirely:

```go
package main

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

	addr := ":8080"
	log.Printf("holmes listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 3: Confirm the workspace root now contains only main.go among Go source files**

Run: `find system-components/holmes/workspace -maxdepth 1 -name '*.go'`
Expected: only `main.go` is listed (no other `.go` files directly in `workspace/`).

- [ ] **Step 4: Full build, vet, and test**

Run: `cd system-components/holmes/workspace && go build ./... && go vet ./... && go test ./... -v -race -count=1 && gofmt -l .`
Expected: build succeeds, `go vet` reports nothing, every test across all five `internal/...` packages PASSES (23 tests total: 2 config + 2 holmes-client + 9 slack-client + 6 slack-handler + 4 alertmanager-handler), `gofmt -l .` prints nothing.

- [ ] **Step 5: Confirm no dangling references to the old flat-package symbols remain**

Run: `cd system-components/holmes/workspace && rg -n 'loadConfig|HolmesClient|NewHolmesClient|slackAPIClient|newSlackAPIClient|verifySlackSignature\(|stripMention\(|buildAskWithHistory\(|slackMessage|slackHandler|alertmanagerHandler' .`
Expected: no output. (Method calls like `.Investigate(`, `.PostMessage(`, `.ConversationsReplies(` are unaffected since those method names didn't change — only the type/function/package-level identifiers that moved packages did.)

- [ ] **Step 6: Smoke-test the binary locally**

```bash
SLACK_SIGNING_SECRET=test SLACK_BOT_TOKEN=test ALERTMANAGER_SHARED_TOKEN=test HOLMES_API_URL=http://example.invalid \
  go run . &
SERVER_PID=$!
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/healthz
kill $SERVER_PID
```

Expected: prints `200`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -s -m "refactor(holmes): wire main.go to internal packages, remove flat files"
```

---

## Task 7: Open Draft PR

**Files:** none (git/GitHub operations only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin refactor/holmes-relay-packages
```

- [ ] **Step 2: Open a Draft PR**

```bash
gh pr create --draft --title "refactor(holmes): split flat package into internal/config, internal/clients/*, internal/handlers/*" --body "$(cat <<'EOF'
## Summary
- Split system-components/holmes/workspace/'s flat `package main` into internal/config, internal/clients/{holmes,slack}, internal/handlers/{slack,alertmanager}.
- Handlers depend on consumer-defined interfaces (investigator, messagePoster) instead of concrete client types.
- No behavior change — pure structural refactor, verified via the full existing test suite (23 tests) passing unchanged in content, only relocated/renamed.

## Test plan
- [ ] `go build ./... && go vet ./... && go test ./... -v -race -count=1` passes (verified locally)
- [ ] `gofmt -l .` reports nothing (verified locally)
- [ ] Local smoke test: binary starts and /healthz returns 200 (verified locally)
- [ ] No dangling references to old flat-package identifiers (verified via rg sweep)

Design: docs/superpowers/specs/2026-08-15-holmes-relay-packages-design.md
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Self-Review Notes

- **Spec coverage**: directory layout (Tasks 1-5 create exactly the structure the design doc specifies), consumer-defined interfaces (Task 4/5's `investigator`/`messagePoster`), `Message` export (Task 3), import aliasing convention (Tasks 4-6), no-behavior-change constraint (every task's tests are behavior-identical to the originals, only relocated/renamed) are all covered.
- **Placeholder scan**: no TBD/TODO markers; all code blocks are complete and self-contained; the one intentional test removal (`TestStripMentionUsedBySignHelper`) and one intentional test-fixture substitution (`holmesChatResponse` → map literal in Task 5) are both explicitly justified inline, not silent gaps.
- **Type consistency**: `investigator`/`messagePoster` interfaces in Task 4 and Task 5 both declare `Investigate(ask string) (string, error)` matching `holmes.Client`'s actual method (Task 2); Task 4's `messagePoster` additionally declares `ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)` matching `slack.Client`'s actual method (Task 3) exactly, including the `slackclient.Message` type. `config.Config`/`config.Load` (Task 1) are referenced identically by both handler packages and `main.go` (Task 6). The import alias convention (`slackclient`, `holmesclient`) is applied consistently across Tasks 4, 5, and 6.
