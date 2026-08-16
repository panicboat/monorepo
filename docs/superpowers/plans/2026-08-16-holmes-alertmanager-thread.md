# holmes Alertmanager Thread Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When holmes investigates a `severity: critical` alert, it should find the Alertmanager-native Slack notification for that alert (by `fingerprint`) and thread its investigation result under it — falling back to posting its own notification if the native one can't be found in time.

**Architecture:** `internal/clients/slack/api.go`'s `PostMessage` starts returning the posted message's `ts` (needed to thread a later reply), and gains a sibling `ConversationsHistory` method (mirrors the existing `ConversationsReplies`) for searching recent channel messages. `internal/handlers/alertmanager/handler.go`'s `investigateAlert` searches for the matching notification via `ConversationsHistory`, retrying with exponential backoff (1s initial, x2, giving up once the next wait would exceed a 60s budget) since Alertmanager's `slack_configs` and `webhook_configs` for the same receiver fire concurrently with no ordering guarantee (see `panicboat/platform`'s `docs/superpowers/specs/2026-08-14-holmes-relay-design.md`). If nothing matches, holmes posts its own fallback notification. Either way, the investigation result threads under whichever `ts` was found or created.

**Tech Stack:** Go, `net/http`, table-free unit tests with `httptest` and small hand-written interface mocks.

## Global Constraints

- Code elements (names, comments, commit messages) in English — this applies regardless of any other file's existing style.
- `git commit -s`, no `Co-Authored-By`.
- Backoff schedule: initial interval 1 second, multiplier x2, give up (return no match) once the *next* planned wait would push past a 60-second total budget from the search's start. This yields real attempts at approximately t=0s, 1s, 3s, 7s, 15s, 31s (6 sleeps: 1s, 2s, 4s, 8s, 16s, 32s) before giving up — 7 search attempts total.
- Search matches by finding the alert's `fingerprint` as a substring of a message's `text` — this is the same value Alertmanager's Slack notification template embeds (`panicboat/platform` side, already shipped).
- An alert with an empty `fingerprint` skips search entirely and goes straight to the fallback notification (defensive: production Alertmanager always sends a fingerprint, but nothing should hang searching for an empty string).

---

## Task 1: `PostMessage` returns the message ts; add `ConversationsHistory`

**Files:**
- Modify: `system-components/holmes/workspace/internal/clients/slack/api.go`
- Modify: `system-components/holmes/workspace/internal/clients/slack/api_test.go`
- Modify: `system-components/holmes/workspace/internal/handlers/slack/handler.go`

**Interfaces:**
- Produces: `(*slack.Client) PostMessage(channel, threadTs, text string) (string, error)` — return value is the posted message's `ts`. `(*slack.Client) ConversationsHistory(channel, oldest string) ([]Message, error)` — `oldest` is a Slack ts-format Unix timestamp string; returns messages no older than it, newest first, same `Message` struct as `ConversationsReplies`.
- Consumed by: Task 2's `alertmanager` handler.

- [ ] **Step 1: Update the failing tests first**

Replace the full contents of `system-components/holmes/workspace/internal/clients/slack/api_test.go`:

```go
package slack

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "ts": "123.456"})
	}))
	defer server.Close()

	c := New("xoxb-test")
	c.BaseURL = server.URL
	ts, err := c.PostMessage("C123", "T123", "hello")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ts != "123.456" {
		t.Errorf("got ts %q, want %q", ts, "123.456")
	}
	if gotBody["channel"] != "C123" || gotBody["thread_ts"] != "T123" || gotBody["text"] != "hello" {
		t.Errorf("unexpected body: %+v", gotBody)
	}
}

func TestClient_PostMessage_NoThread(t *testing.T) {
	var gotBody map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&gotBody)
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "ts": "1.1"})
	}))
	defer server.Close()

	c := New("xoxb-test")
	c.BaseURL = server.URL
	if _, err := c.PostMessage("C123", "", "hello"); err != nil {
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

func TestClient_ConversationsHistory(t *testing.T) {
	var gotQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/conversations.history" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		gotQuery = r.URL.RawQuery
		json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"messages": []Message{
				{Text: "critical alert fingerprint: `abc123`", Ts: "999.111"},
			},
		})
	}))
	defer server.Close()

	c := New("xoxb-test")
	c.BaseURL = server.URL
	msgs, err := c.ConversationsHistory("C123", "1700000000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 1 || msgs[0].Ts != "999.111" {
		t.Fatalf("unexpected messages: %+v", msgs)
	}
	if !strings.Contains(gotQuery, "oldest=1700000000") {
		t.Errorf("expected oldest param in query, got: %s", gotQuery)
	}
}

func TestClient_PostMessage_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "channel_not_found"})
	}))
	defer server.Close()

	c := New("xoxb-test")
	c.BaseURL = server.URL
	if _, err := c.PostMessage("C123", "", "hello"); err == nil {
		t.Fatal("expected error, got nil")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail to compile**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/slack/...`
Expected: compile error — `c.PostMessage(...)` returns 2 values but is used as 1 (the old `api.go` hasn't changed yet).

- [ ] **Step 3: Rewrite `api.go`**

Replace the full contents of `system-components/holmes/workspace/internal/clients/slack/api.go`:

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

func (c *Client) PostMessage(channel, threadTs, text string) (string, error) {
	payload := map[string]string{
		"channel": channel,
		"text":    text,
	}
	if threadTs != "" {
		payload["thread_ts"] = threadTs
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/chat.postMessage", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", "Bearer "+c.BotToken)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call slack api: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
		Ts    string `json:"ts"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return "", fmt.Errorf("slack api error: %s", result.Error)
	}
	return result.Ts, nil
}

func (c *Client) ConversationsReplies(channel, threadTs string) ([]Message, error) {
	url := fmt.Sprintf("%s/conversations.replies?channel=%s&ts=%s",
		c.BaseURL, neturl.QueryEscape(channel), neturl.QueryEscape(threadTs))
	return c.getMessages(url)
}

// ConversationsHistory fetches messages in channel no older than oldest (a
// Slack ts-format Unix timestamp string). Used to search for the
// Alertmanager-native notification a critical alert's investigation
// should thread under.
func (c *Client) ConversationsHistory(channel, oldest string) ([]Message, error) {
	url := fmt.Sprintf("%s/conversations.history?channel=%s&oldest=%s&limit=50",
		c.BaseURL, neturl.QueryEscape(channel), neturl.QueryEscape(oldest))
	return c.getMessages(url)
}

func (c *Client) getMessages(url string) ([]Message, error) {
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
```

This removes the old `doSlackRequest` helper (it only served `PostMessage`, which now needs the extra `Ts` field and decodes its response directly) and extracts a shared `getMessages` helper for `ConversationsReplies`/`ConversationsHistory`, which are now identical except for the URL.

- [ ] **Step 4: Run tests to verify the slack package passes**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/slack/... -v`
Expected: PASS, all tests including the two new ones.

- [ ] **Step 5: Update the slack handler for the new `PostMessage` signature**

`system-components/holmes/workspace/internal/handlers/slack/handler.go` currently fails to compile because its `messagePoster` interface and call sites still expect `PostMessage` to return only `error`. Modify:

Find:

```go
type messagePoster interface {
	PostMessage(channel, threadTs, text string) error
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
}
```

Replace with:

```go
type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
}
```

Find (in `handleMention`):

```go
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
```

Replace with (discard the returned ts with `_` — this handler already knows its thread from the Slack event itself, it doesn't need a returned ts):

```go
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
```

No changes needed to `handler_test.go` in this package — its tests exercise `handleMention` end-to-end via a real `*slackclient.Client` against an `httptest` server and never inspect `PostMessage`'s return value directly, so they keep passing once the package compiles.

- [ ] **Step 6: Run the full holmes test suite**

Run: `cd system-components/holmes/workspace && go build ./... && go test ./...`
Expected: builds clean, all packages PASS.

- [ ] **Step 7: Commit**

```bash
git add system-components/holmes/workspace/internal/clients/slack/api.go system-components/holmes/workspace/internal/clients/slack/api_test.go system-components/holmes/workspace/internal/handlers/slack/handler.go
git commit -s -m "feat(system-components/holmes): return message ts from PostMessage, add ConversationsHistory"
```

---

## Task 2: Fingerprint search, backoff, fallback, threaded reply in the Alertmanager handler

**Files:**
- Modify: `system-components/holmes/workspace/internal/handlers/alertmanager/handler.go`
- Modify: `system-components/holmes/workspace/internal/handlers/alertmanager/handler_test.go`

**Interfaces:**
- Consumes: `(*slack.Client) PostMessage(channel, threadTs, text string) (string, error)` and `ConversationsHistory(channel, oldest string) ([]slack.Message, error)` (Task 1).
- Produces: `alertmanagerAlert.Fingerprint string` field (JSON key `fingerprint`) — no other package reads this yet, but it's part of Alertmanager's standard webhook payload shape.

- [ ] **Step 1: Write the new/updated tests first**

Replace the full contents of `system-components/holmes/workspace/internal/handlers/alertmanager/handler_test.go`:

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
	posted := make(chan string, 2)

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
	// No "fingerprint" in the payload, so investigateAlert skips the
	// search and posts a fallback notification before threading the
	// analysis under it — two messages total.
	body := []byte(`{"alerts":[{"status":"firing","labels":{"alertname":"KubePodCrashLooping","severity":"critical"},"annotations":{"summary":"pod is crash looping"}}]}`)
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook?channel=incidents", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer secret-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want %d", w.Code, http.StatusOK)
	}

	var texts []string
	for i := 0; i < 2; i++ {
		select {
		case text := <-posted:
			texts = append(texts, text)
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out waiting for message %d of 2", i+1)
		}
	}
	if !strings.Contains(texts[1], "found the cause") {
		t.Errorf("expected the second posted message to contain the analysis, got: %v", texts)
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

func TestBuildFallbackNotification(t *testing.T) {
	alert := alertmanagerAlert{
		Labels:      map[string]string{"alertname": "KubePodCrashLooping", "severity": "critical"},
		Annotations: map[string]string{"summary": "pod is crash looping"},
		Fingerprint: "abc123",
	}
	text := buildFallbackNotification(alert)
	if !strings.Contains(text, "KubePodCrashLooping") {
		t.Errorf("expected alertname in fallback text, got: %s", text)
	}
	if !strings.Contains(text, "abc123") {
		t.Errorf("expected fingerprint in fallback text, got: %s", text)
	}
}

// mockPoster is a hand-written messagePoster for tests that need precise,
// per-call control over ConversationsHistory results (httptest can't easily
// script different responses for repeated calls to the same path).
type mockPoster struct {
	historyResponses [][]slackclient.Message
	historyCallCount int

	postCalls []postCall
	postTs    string
}

type postCall struct {
	channel  string
	threadTs string
	text     string
}

func (m *mockPoster) PostMessage(channel, threadTs, text string) (string, error) {
	m.postCalls = append(m.postCalls, postCall{channel, threadTs, text})
	return m.postTs, nil
}

func (m *mockPoster) ConversationsHistory(channel, oldest string) ([]slackclient.Message, error) {
	idx := m.historyCallCount
	m.historyCallCount++
	if idx < len(m.historyResponses) {
		return m.historyResponses[idx], nil
	}
	if len(m.historyResponses) > 0 {
		return m.historyResponses[len(m.historyResponses)-1], nil
	}
	return nil, nil
}

func TestFindNotificationTs_FoundImmediately(t *testing.T) {
	mock := &mockPoster{
		historyResponses: [][]slackclient.Message{
			{{Text: "Critical alert fingerprint: `abc123`", Ts: "111.222"}},
		},
	}
	h := &Handler{Client: mock, Sleep: func(time.Duration) {}}

	ts := h.findNotificationTs("C1", "abc123")

	if ts != "111.222" {
		t.Errorf("got ts %q, want %q", ts, "111.222")
	}
	if mock.historyCallCount != 1 {
		t.Errorf("expected 1 history call, got %d", mock.historyCallCount)
	}
}

func TestFindNotificationTs_FoundAfterRetry(t *testing.T) {
	var sleeps []time.Duration
	mock := &mockPoster{
		historyResponses: [][]slackclient.Message{
			{},
			{},
			{{Text: "fingerprint: `abc123`", Ts: "333.444"}},
		},
	}
	h := &Handler{Client: mock, Sleep: func(d time.Duration) { sleeps = append(sleeps, d) }}

	ts := h.findNotificationTs("C1", "abc123")

	if ts != "333.444" {
		t.Errorf("got ts %q, want %q", ts, "333.444")
	}
	if mock.historyCallCount != 3 {
		t.Errorf("expected 3 history calls, got %d", mock.historyCallCount)
	}
	if len(sleeps) != 2 || sleeps[0] != time.Second || sleeps[1] != 2*time.Second {
		t.Errorf("expected exponential backoff [1s 2s], got %v", sleeps)
	}
}

func TestFindNotificationTs_NeverFound_GivesUp(t *testing.T) {
	var sleeps []time.Duration
	mock := &mockPoster{historyResponses: [][]slackclient.Message{{}}}
	h := &Handler{Client: mock, Sleep: func(d time.Duration) { sleeps = append(sleeps, d) }}

	ts := h.findNotificationTs("C1", "never-matches")

	if ts != "" {
		t.Errorf("expected empty ts when nothing matches, got %q", ts)
	}
	if mock.historyCallCount != 7 {
		t.Errorf("expected 7 history calls (initial + 6 retries), got %d", mock.historyCallCount)
	}
	want := []time.Duration{time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 16 * time.Second, 32 * time.Second}
	if len(sleeps) != len(want) {
		t.Fatalf("expected %d sleeps, got %d: %v", len(want), len(sleeps), sleeps)
	}
	for i, w := range want {
		if sleeps[i] != w {
			t.Errorf("sleep[%d] = %v, want %v", i, sleeps[i], w)
		}
	}
}

func TestFindNotificationTs_EmptyFingerprint_SkipsSearch(t *testing.T) {
	mock := &mockPoster{}
	h := &Handler{Client: mock}

	ts := h.findNotificationTs("C1", "")

	if ts != "" {
		t.Errorf("expected empty ts for empty fingerprint, got %q", ts)
	}
	if mock.historyCallCount != 0 {
		t.Errorf("expected no history calls for empty fingerprint, got %d", mock.historyCallCount)
	}
}

func TestInvestigateAlert_FoundNotification_ThreadsReply(t *testing.T) {
	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"analysis": "found the cause"})
	}))
	defer holmesServer.Close()

	mock := &mockPoster{
		historyResponses: [][]slackclient.Message{
			{{Text: "*KubePodCrashLooping* fingerprint: `abc123`", Ts: "999.111"}},
		},
		postTs: "should-not-be-used",
	}

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: mock,
		Sleep:  func(time.Duration) {},
	}

	alert := alertmanagerAlert{
		Status:      "firing",
		Labels:      map[string]string{"alertname": "KubePodCrashLooping", "severity": "critical"},
		Annotations: map[string]string{"summary": "pod is crash looping"},
		Fingerprint: "abc123",
	}

	h.investigateAlert(alert, "C1")

	if len(mock.postCalls) != 1 {
		t.Fatalf("expected exactly 1 PostMessage call (no fallback needed), got %d: %+v", len(mock.postCalls), mock.postCalls)
	}
	final := mock.postCalls[0]
	if final.threadTs != "999.111" {
		t.Errorf("expected analysis threaded under found ts %q, got %q", "999.111", final.threadTs)
	}
	if !strings.Contains(final.text, "found the cause") {
		t.Errorf("expected analysis text, got %q", final.text)
	}
}

func TestInvestigateAlert_NotFound_PostsFallbackAndThreads(t *testing.T) {
	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"analysis": "found the cause"})
	}))
	defer holmesServer.Close()

	mock := &mockPoster{
		historyResponses: [][]slackclient.Message{{}},
		postTs:           "fallback-ts-555",
	}

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: mock,
		Sleep:  func(time.Duration) {},
	}

	alert := alertmanagerAlert{
		Status:      "firing",
		Labels:      map[string]string{"alertname": "KubePodCrashLooping", "severity": "critical"},
		Annotations: map[string]string{"summary": "pod is crash looping"},
		Fingerprint: "never-matches",
	}

	h.investigateAlert(alert, "C1")

	if len(mock.postCalls) != 2 {
		t.Fatalf("expected 2 PostMessage calls (fallback notification + threaded analysis), got %d: %+v", len(mock.postCalls), mock.postCalls)
	}
	fallback := mock.postCalls[0]
	if fallback.threadTs != "" {
		t.Errorf("expected fallback notification to be a new top-level message, got threadTs=%q", fallback.threadTs)
	}
	if !strings.Contains(fallback.text, "never-matches") {
		t.Errorf("expected fallback notification to include the fingerprint, got %q", fallback.text)
	}
	final := mock.postCalls[1]
	if final.threadTs != "fallback-ts-555" {
		t.Errorf("expected analysis threaded under fallback ts %q, got %q", "fallback-ts-555", final.threadTs)
	}
	if !strings.Contains(final.text, "found the cause") {
		t.Errorf("expected analysis text, got %q", final.text)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail to compile**

Run: `cd system-components/holmes/workspace && go test ./internal/handlers/alertmanager/...`
Expected: compile errors — `alertmanagerAlert` has no field `Fingerprint`, `Handler` has no field `Sleep`, `findNotificationTs`/`investigateAlert`/`buildFallbackNotification` signatures don't match what the tests call, `messagePoster` has no `ConversationsHistory` method.

- [ ] **Step 3: Rewrite `handler.go`**

Replace the full contents of `system-components/holmes/workspace/internal/handlers/alertmanager/handler.go`:

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
	"time"

	slackclient "github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
)

type investigator interface {
	Investigate(ask string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsHistory(channel, oldest string) ([]slackclient.Message, error)
}

type alertmanagerWebhook struct {
	Status string              `json:"status"`
	Alerts []alertmanagerAlert `json:"alerts"`
}

type alertmanagerAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Fingerprint string            `json:"fingerprint"`
}

const (
	searchInitialInterval = 1 * time.Second
	searchMaxTotal        = 60 * time.Second
	searchBackoffFactor   = 2
)

type Handler struct {
	Cfg    config.Config
	Holmes investigator
	Client messagePoster
	// Sleep defaults to time.Sleep. Tests inject a call-recording no-op so
	// the retry loop's attempt count and deadline handling run without
	// real waiting.
	Sleep func(time.Duration)
}

func (h *Handler) sleep(d time.Duration) {
	if h.Sleep != nil {
		h.Sleep(d)
		return
	}
	time.Sleep(d)
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
	ts := h.findNotificationTs(channel, alert.Fingerprint)
	if ts == "" {
		fallbackTs, err := h.Client.PostMessage(channel, "", buildFallbackNotification(alert))
		if err != nil {
			log.Printf("failed to post fallback notification: %v", err)
		}
		ts = fallbackTs
	}

	ask := buildAlertAsk(alert)

	analysis, err := h.Holmes.Investigate(ask)
	if err != nil {
		if _, postErr := h.Client.PostMessage(channel, ts, fmt.Sprintf("investigation failed for alert %s: %v", alert.Labels["alertname"], err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if _, err := h.Client.PostMessage(channel, ts, fmt.Sprintf("*Alert: %s*\n%s", alert.Labels["alertname"], analysis)); err != nil {
		log.Printf("failed to post analysis: %v", err)
	}
}

// findNotificationTs searches recent channel history for the
// Alertmanager-native notification matching this alert's fingerprint,
// retrying with exponential backoff since Alertmanager's slack_configs and
// webhook_configs for the same receiver fire concurrently with no ordering
// guarantee. Returns "" if nothing matches within the search budget, or
// immediately if fingerprint is empty (nothing to match against).
func (h *Handler) findNotificationTs(channel, fingerprint string) string {
	if fingerprint == "" {
		return ""
	}

	oldest := fmt.Sprintf("%d", time.Now().Add(-2*time.Minute).Unix())
	deadline := time.Now().Add(searchMaxTotal)
	interval := searchInitialInterval

	for {
		if ts := h.searchByFingerprint(channel, oldest, fingerprint); ts != "" {
			return ts
		}
		if time.Now().Add(interval).After(deadline) {
			return ""
		}
		h.sleep(interval)
		interval *= searchBackoffFactor
	}
}

func (h *Handler) searchByFingerprint(channel, oldest, fingerprint string) string {
	messages, err := h.Client.ConversationsHistory(channel, oldest)
	if err != nil {
		log.Printf("failed to search conversation history: %v", err)
		return ""
	}
	for _, m := range messages {
		if strings.Contains(m.Text, fingerprint) {
			return m.Ts
		}
	}
	return ""
}

func buildFallbackNotification(alert alertmanagerAlert) string {
	return fmt.Sprintf("*%s* (%s)\n%s\nfingerprint: `%s`",
		alert.Labels["alertname"], alert.Labels["severity"], alert.Annotations["summary"], alert.Fingerprint)
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd system-components/holmes/workspace && go test ./internal/handlers/alertmanager/... -v`
Expected: PASS, all tests including the 6 new ones (`TestBuildFallbackNotification`, `TestFindNotificationTs_FoundImmediately`, `TestFindNotificationTs_FoundAfterRetry`, `TestFindNotificationTs_NeverFound_GivesUp`, `TestFindNotificationTs_EmptyFingerprint_SkipsSearch`, `TestInvestigateAlert_FoundNotification_ThreadsReply`, `TestInvestigateAlert_NotFound_PostsFallbackAndThreads`). All should complete in well under a second — none of them perform a real `time.Sleep`.

- [ ] **Step 5: Run the full holmes test suite and build**

Run: `cd system-components/holmes/workspace && go build ./... && go vet ./... && go test ./...`
Expected: builds clean, `go vet` clean, all packages PASS.

- [ ] **Step 6: Commit**

```bash
git add system-components/holmes/workspace/internal/handlers/alertmanager/handler.go system-components/holmes/workspace/internal/handlers/alertmanager/handler_test.go
git commit -s -m "feat(system-components/holmes): thread Alertmanager investigations under the notification by fingerprint"
```

---

## Task 3: Open Draft PR

**Files:** none (git/GitHub operations only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/holmes-alertmanager-thread
```

- [ ] **Step 2: Open a Draft PR**

```bash
gh pr create --draft --title "feat(system-components/holmes): thread Alertmanager investigations under the notification" --body "$(cat <<'EOF'
## Summary
- `slack.Client.PostMessage` now returns the posted message's `ts`; added `ConversationsHistory` (mirrors `ConversationsReplies`) for searching recent channel messages.
- The Alertmanager handler now searches Slack history for the Alertmanager-native notification matching a firing critical alert's `fingerprint` (exponential backoff, 1s initial / x2 / ~60s budget, since Alertmanager fires the Slack notification and the holmes webhook concurrently with no ordering guarantee), and threads the investigation result under it.
- Falls back to posting its own notification (and threading under that) if the native one isn't found within the search budget.

## Dependencies
- Requires `panicboat/platform`'s Alertmanager-owned Slack notification (already merged, PR #781 + #782) — the fingerprint-embedding notification template this searches for.

## Test plan
- [x] `go build ./... && go vet ./... && go test ./...` — all pass, no real sleeps in the test suite
- [ ] After merge and deploy: fire a test critical alert and confirm the investigation result threads under the existing Alertmanager notification in #platform-alert-p1

Design: docs/superpowers/specs/2026-08-14-holmes-relay-design.md (panicboat/platform repo)
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Self-Review Notes

- **Spec coverage**: fingerprint search via `conversations.history` (design's "検索キー" bullet), exponential backoff ~1 minute total (design's "リトライ" bullet, this plan's Global Constraints spell out the exact schedule the design left approximate), fallback self-post (design's "フォールバック" bullet), threading either way (design's final bullet) are all covered by Task 2.
- **Placeholder scan**: none — every code block is the complete file content or a complete find/replace pair, no TBD markers.
- **Type/naming consistency**: `PostMessage`'s new `(string, error)` signature is introduced in Task 1 and consumed identically by both `handlers/slack/handler.go` (Task 1, discards the ts) and `handlers/alertmanager/handler.go` (Task 2, uses the ts for threading). `ConversationsHistory(channel, oldest string) ([]Message, error)` is defined in Task 1 and consumed by Task 2's `messagePoster` interface and `searchByFingerprint` with matching parameter order and types.
- **Testability**: the `Handler.Sleep` field (Task 2) is the mechanism that keeps `TestFindNotificationTs_NeverFound_GivesUp` and `TestInvestigateAlert_NotFound_PostsFallbackAndThreads` fast despite exercising the full 7-attempt/6-sleep backoff schedule — worth calling out explicitly since it's not obvious from the production code path alone (production never sets `Sleep`, so `h.sleep` falls through to real `time.Sleep`).
