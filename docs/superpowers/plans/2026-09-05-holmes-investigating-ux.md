# Holmes Investigating UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `🔍 investigating...` thread message with emoji reactions on the mention message itself, so the acknowledgement doesn't clutter the thread.

**Architecture:** `internal/clients/slack.Client` gains `AddReaction(channel, ts, name string) error` wrapping Slack's `reactions.add` API. `internal/handlers/slack.Handler.handleMention` adds an `:eyes:` reaction to the mention message on receipt, then — once `Holmes.Chat` returns — adds `:white_check_mark:` on success or `:face_vomiting:` on failure, leaving `:eyes:` in place either way. The thread-reply behavior (analysis text, action results, error messages) is unchanged; only the old ack message disappears.

**Tech Stack:** Go 1.24, stdlib `net/http`, `net/http/httptest` for tests (existing patterns).

**Spec:** `docs/superpowers/specs/2026-09-05-holmes-action-architecture-design.md`, section "6. Investigating UX — メッセージ投稿からリアクションへ"

**Prerequisite:** This plan's `handler_test.go` (Task 2, Step 1) is written against the `actionEnvelope`/`createIssuePayload`/`dispatchAction` shape introduced by `docs/superpowers/plans/2026-09-05-holmes-action-envelope.md`. Apply that plan first — this plan's test rewrite will not compile against the pre-envelope `issueAction` struct.

## Global Constraints

- Reaction target is always `evt.Ts` (the mention message itself), never `threadTs` — matches the spec's "メンション元の投稿（evt.Ts）へのリアクション付与".
- `:eyes:` is never removed — success/failure reactions are additions, not replacements.
- A reaction API failure must never block posting the analysis/error/action result to the thread — same fire-and-log pattern already used for `PostMessage` failures elsewhere in this handler.
- No change to `dispatchAction`, `handleCreateIssue`, `parseActionEnvelope`, or any action-envelope logic — this plan only touches the ack step at the top of `handleMention` and the success/failure reaction after `Holmes.Chat` returns.

---

## File Structure

- Modify: `system-components/holmes/internal/clients/slack/api.go`
- Modify: `system-components/holmes/internal/clients/slack/api_test.go`
- Modify: `system-components/holmes/internal/handlers/slack/handler.go`
- Modify: `system-components/holmes/internal/handlers/slack/handler_test.go`

---

### Task 1: Add `Client.AddReaction` to the Slack API client

**Files:**
- Modify: `system-components/holmes/internal/clients/slack/api.go`
- Modify: `system-components/holmes/internal/clients/slack/api_test.go`

**Interfaces:**
- Consumes: nothing new
- Produces: `(*Client).AddReaction(channel, ts, name string) error` — POSTs to `reactions.add` with `channel`, `timestamp`, `name`; returns an error if the HTTP call fails or the API responds `"ok": false`. Task 2 depends on this exact signature.

- [ ] **Step 1: Write the failing tests**

Add to the end of `system-components/holmes/internal/clients/slack/api_test.go`:

```go
func TestClient_AddReaction(t *testing.T) {
	var gotBody map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/reactions.add" {
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
	if err := c.AddReaction("C123", "100.001", "eyes"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotBody["channel"] != "C123" || gotBody["timestamp"] != "100.001" || gotBody["name"] != "eyes" {
		t.Errorf("unexpected body: %+v", gotBody)
	}
}

func TestClient_AddReaction_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "invalid_name"})
	}))
	defer server.Close()

	c := New("xoxb-test")
	c.BaseURL = server.URL
	if err := c.AddReaction("C123", "100.001", "not-a-real-emoji"); err == nil {
		t.Fatal("expected error, got nil")
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd system-components/holmes && go test ./internal/clients/slack/... -run TestClient_AddReaction -v`
Expected: FAIL to compile — `c.AddReaction undefined (type *Client has no field or method AddReaction)`.

- [ ] **Step 3: Implement `AddReaction`**

In `system-components/holmes/internal/clients/slack/api.go`, add this method directly after `PostMessage` (before `ConversationsReplies`):

```go
// AddReaction adds an emoji reaction (name without colons, e.g. "eyes")
// to the message at ts in channel, via Slack's reactions.add.
func (c *Client) AddReaction(channel, ts, name string) error {
	payload := map[string]string{
		"channel":   channel,
		"timestamp": ts,
		"name":      name,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/reactions.add", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", "Bearer "+c.BotToken)

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

No new imports are needed — `bytes`, `encoding/json`, `fmt`, `net/http` are already imported in this file.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd system-components/holmes && go test ./internal/clients/slack/... -v`
Expected: PASS — all tests including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/internal/clients/slack
git commit -s -m "feat(system-components/holmes): add slack.Client.AddReaction"
```

---

### Task 2: Replace the investigating message with reactions in `handleMention`

**Files:**
- Modify: `system-components/holmes/internal/handlers/slack/handler.go`
- Modify: `system-components/holmes/internal/handlers/slack/handler_test.go`

**Interfaces:**
- Consumes: `(*slackclient.Client).AddReaction` (Task 1)
- Produces: no new exported names — `messagePoster` gains `AddReaction(channel, ts, name string) error` as a required method, satisfied transparently by `*slackclient.Client` (Task 1). This is the last task in the plan.

- [ ] **Step 1: Update `handler_test.go` for the reaction-based flow**

Replace the full contents of `system-components/holmes/internal/handlers/slack/handler_test.go`. This adds a `case "/reactions.add":` to every fake Slack server that exercises `handleMention` (so reaction calls don't hit each test's `default: t.Errorf(...)` branch), records reactions where a test asserts on them, and adjusts the `posted` message counts now that the ack message is gone:

```go
package slack

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
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
	var reactions []map[string]string
	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chat.postMessage":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		case "/reactions.add":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			reactions = append(reactions, body)
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

	if len(posted) != 1 {
		t.Fatalf("expected exactly 1 posted message (the result, no ack message), got %d: %+v", len(posted), posted)
	}
	final := posted[len(posted)-1]
	if final["thread_ts"] != "100.001" {
		t.Errorf("expected final post thread_ts=%q (evt.Ts), got %q", "100.001", final["thread_ts"])
	}
	if final["text"] != "root cause found" {
		t.Errorf("expected final post text=%q, got %q", "root cause found", final["text"])
	}

	if len(reactions) != 2 {
		t.Fatalf("expected exactly 2 reactions (eyes, white_check_mark), got %d: %+v", len(reactions), reactions)
	}
	if reactions[0]["name"] != "eyes" || reactions[0]["timestamp"] != "100.001" {
		t.Errorf("expected first reaction eyes on evt.Ts, got: %+v", reactions[0])
	}
	if reactions[1]["name"] != "white_check_mark" || reactions[1]["timestamp"] != "100.001" {
		t.Errorf("expected second reaction white_check_mark on evt.Ts, got: %+v", reactions[1])
	}
}

func TestHandleMention_ThreadHistory(t *testing.T) {
	var repliesCalled bool
	var posted []map[string]string

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
		case "/reactions.add":
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			t.Errorf("unexpected slack path: %s", r.URL.Path)
		}
	}))
	defer slackServer.Close()

	var gotAsk string
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
	if len(posted) != 1 {
		t.Fatalf("expected exactly 1 posted message, got %d: %+v", len(posted), posted)
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
		case "/reactions.add":
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
	if len(posted) != 1 {
		t.Fatalf("expected exactly 1 posted message despite the conversations.replies failure, got %d: %+v", len(posted), posted)
	}
	final := posted[len(posted)-1]
	if final["text"] != "investigated anyway" {
		t.Errorf("expected the investigation result to still be posted, got: %+v", final)
	}
}

func TestHandleMention_ChatFailure(t *testing.T) {
	var posted []map[string]string
	var reactions []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chat.postMessage":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		case "/reactions.add":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			reactions = append(reactions, body)
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

	if len(posted) != 1 {
		t.Fatalf("expected exactly 1 posted message (the failure), got %d: %+v", len(posted), posted)
	}
	final := posted[len(posted)-1]
	if !strings.Contains(final["text"], "investigation failed") {
		t.Errorf("expected a failure message to be posted, got: %+v", final)
	}

	if len(reactions) != 2 {
		t.Fatalf("expected exactly 2 reactions (eyes, face_vomiting), got %d: %+v", len(reactions), reactions)
	}
	if reactions[0]["name"] != "eyes" {
		t.Errorf("expected first reaction eyes, got: %+v", reactions[0])
	}
	if reactions[1]["name"] != "face_vomiting" {
		t.Errorf("expected second reaction face_vomiting on Chat failure, got: %+v", reactions[1])
	}
}

func TestHandleMention_ReactionFailureDoesNotBlockInvestigation(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/reactions.add":
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

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"analysis": "found it anyway"})
	}))
	defer holmesServer.Close()

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: &slackclient.Client{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
	}

	h.handleMention(slackInnerEvent{
		Type: "app_mention", Channel: "C123", User: "U1",
		Text: "<@BOT> investigate this", Ts: "100",
	})

	if len(posted) != 1 || posted[0]["text"] != "found it anyway" {
		t.Fatalf("expected the analysis to still be posted despite reaction failures, got: %+v", posted)
	}
}

type fakeGitHub struct {
	createIssueFunc func(repo, title, body string, labels []string) (string, error)
	calledRepo      string
	calledTitle     string
	calledBody      string
	calledLabels    []string
}

func (f *fakeGitHub) CreateIssue(repo, title, body string, labels []string) (string, error) {
	f.calledRepo = repo
	f.calledTitle = title
	f.calledBody = body
	f.calledLabels = labels
	return f.createIssueFunc(repo, title, body, labels)
}

func TestHandleMention_CreateIssue_ReadyTrue(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chat.getPermalink":
			json.NewEncoder(w).Encode(map[string]any{"ok": true, "permalink": "https://panicboat.slack.com/archives/C123/p100"})
		case "/reactions.add":
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		}
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": `{"action":"create_issue","ready":true,"payload":{"repo":"panicboat/monorepo","title":"bug title","body":"bug body"}}`,
		})
	}))
	defer holmesServer.Close()

	var gotLabels []string
	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string, labels []string) (string, error) {
		gotLabels = labels
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

	if gh.calledRepo != "panicboat/monorepo" || gh.calledTitle != "bug title" {
		t.Errorf("unexpected CreateIssue call: repo=%q title=%q", gh.calledRepo, gh.calledTitle)
	}
	if !strings.Contains(gh.calledBody, "bug body") {
		t.Errorf("expected the issue body to still contain the synthesized content, got: %q", gh.calledBody)
	}
	if !strings.Contains(gh.calledBody, "https://panicboat.slack.com/archives/C123/p100") {
		t.Errorf("expected the issue body to contain the thread permalink, got: %q", gh.calledBody)
	}
	if len(gotLabels) != 0 {
		t.Errorf("expected no labels when the payload has no severity, got: %v", gotLabels)
	}
	final := posted[len(posted)-1]
	if !strings.Contains(final["text"], "https://github.com/panicboat/monorepo/issues/42") {
		t.Errorf("expected the final post to contain the issue URL, got: %+v", final)
	}
}

func TestHandleMention_CreateIssue_SeverityLabel(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chat.getPermalink":
			json.NewEncoder(w).Encode(map[string]any{"ok": true, "permalink": "https://panicboat.slack.com/archives/C123/p100"})
		case "/reactions.add":
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		}
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": `{"action":"create_issue","ready":true,"payload":{"repo":"panicboat/platform","title":"t","body":"b","severity":"critical"}}`,
		})
	}))
	defer holmesServer.Close()

	var gotLabels []string
	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string, labels []string) (string, error) {
		gotLabels = labels
		return "https://github.com/panicboat/platform/issues/1", nil
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

	if len(gotLabels) != 1 || gotLabels[0] != "critical" {
		t.Errorf("expected labels [\"critical\"], got: %v", gotLabels)
	}
}

func TestHandleMention_CreateIssue_CodeFenceWrapped(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/reactions.add":
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		}
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": "```json\n" + `{"action":"create_issue","ready":true,"payload":{"repo":"panicboat/monorepo","title":"t","body":"b"}}` + "\n```",
		})
	}))
	defer holmesServer.Close()

	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string, labels []string) (string, error) {
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

func TestHandleMention_CreateIssue_ReadyFalse(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/reactions.add":
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		}
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": `{"action":"create_issue","ready":false,"reason":"source investigation found the bug there","payload":{"repo":"panicboat/platform"}}`,
		})
	}))
	defer holmesServer.Close()

	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string, labels []string) (string, error) {
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
		switch r.URL.Path {
		case "/reactions.add":
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		}
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": `{"action":"create_issue","ready":true,"payload":{"repo":"panicboat/monorepo","title":"t","body":"b"}}`,
		})
	}))
	defer holmesServer.Close()

	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string, labels []string) (string, error) {
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

func TestHandleMention_UnknownAction(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/reactions.add":
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		}
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": `{"action":"close_issue","ready":true,"payload":{}}`,
		})
	}))
	defer holmesServer.Close()

	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string, labels []string) (string, error) {
		t.Fatal("CreateIssue must not be called for an unrecognized action")
		return "", nil
	}}

	h := &Handler{
		Holmes: holmesclient.New(holmesServer.URL, "test-model"),
		Client: &slackclient.Client{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
		GitHub: gh,
	}

	h.handleMention(slackInnerEvent{
		Type: "app_mention", Channel: "C123", User: "U1",
		Text: "<@BOT> close this issue", Ts: "100",
	})

	final := posted[len(posted)-1]
	if final["text"] == `{"action":"close_issue","ready":true,"payload":{}}` {
		t.Fatalf("unrecognized action must not fall through to posting the raw JSON as text, got: %+v", final)
	}
	if !strings.Contains(final["text"], "アクションの解析に失敗しました") {
		t.Errorf("expected an action-parse-failure message for an unrecognized action, got: %+v", final)
	}
}

func TestHandleMention_MalformedCreateIssuePayload(t *testing.T) {
	var posted []map[string]string

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/reactions.add":
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			posted = append(posted, body)
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		}
	}))
	defer slackServer.Close()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"analysis": `{"action":"create_issue","ready":true,"payload":"not an object"}`,
		})
	}))
	defer holmesServer.Close()

	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string, labels []string) (string, error) {
		t.Fatal("CreateIssue must not be called when the payload fails to decode")
		return "", nil
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
	if !strings.Contains(final["text"], "アクションの解析に失敗しました") {
		t.Errorf("expected an action-parse-failure message when the payload fails to decode, got: %+v", final)
	}
}
```

- [ ] **Step 2: Run tests to verify the changed ones fail**

Run: `cd system-components/holmes && go test ./internal/handlers/slack/... -v`
Expected: FAIL — `TestHandleMention_TopLevelMention`, `TestHandleMention_ThreadHistory`, and `TestHandleMention_ConversationsRepliesFailure` fail their `len(posted) != 1` checks (current code still posts the `🔍 investigating...` ack, so `posted` has 2 entries). `TestHandleMention_TopLevelMention` and `TestHandleMention_ChatFailure` also fail their reaction-count checks (current code never calls `AddReaction`, so `reactions` is empty). `TestHandleMention_ReactionFailureDoesNotBlockInvestigation` passes vacuously at this stage — `AddReaction` isn't called yet, so the reaction failure it injects has nothing to affect; it becomes a meaningful check once Step 3 wires `AddReaction` into `handleMention`.

- [ ] **Step 3: Update `handler.go`**

In `system-components/holmes/internal/handlers/slack/handler.go`:

Add `AddReaction` to the `messagePoster` interface:

```go
type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
	GetPermalink(channel, ts string) (string, error)
	AddReaction(channel, ts, name string) error
}
```

Replace the body of `handleMention` (everything from the `ask :=` line through the end of the function) with:

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

	if err := h.Client.AddReaction(evt.Channel, evt.Ts, "eyes"); err != nil {
		log.Printf("failed to add eyes reaction: %v", err)
	}

	response, err := h.Holmes.Chat(ask)
	if err != nil {
		if reactErr := h.Client.AddReaction(evt.Channel, evt.Ts, "face_vomiting"); reactErr != nil {
			log.Printf("failed to add face_vomiting reaction: %v", reactErr)
		}
		if _, postErr := h.Client.PostMessage(evt.Channel, threadTs, fmt.Sprintf("investigation failed: %v", err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if err := h.Client.AddReaction(evt.Channel, evt.Ts, "white_check_mark"); err != nil {
		log.Printf("failed to add white_check_mark reaction: %v", err)
	}

	env, ok := parseActionEnvelope(response)
	if !ok {
		if _, err := h.Client.PostMessage(evt.Channel, threadTs, response); err != nil {
			log.Printf("failed to post analysis: %v", err)
		}
		return
	}

	h.dispatchAction(evt.Channel, threadTs, env)
}
```

Every other function in the file (`ServeHTTP`, `parseActionEnvelope`, `dispatchAction`, `handleCreateIssue`, `stripCodeFence`) is unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd system-components/holmes && go test ./internal/handlers/slack/... -v`
Expected: PASS — all tests, including the reaction-count and reaction-order assertions.

- [ ] **Step 5: Run the full test suite**

Run: `cd system-components/holmes && go build ./... && go vet ./... && go test ./... -v -race -count=1`
Expected: PASS everywhere.

- [ ] **Step 6: Commit**

```bash
git add system-components/holmes/internal/handlers/slack
git commit -s -m "feat(system-components/holmes): replace investigating message with eyes/white_check_mark/face_vomiting reactions"
```

---

## Final Verification

- [ ] Run: `cd system-components/holmes && go build ./... && go vet ./... && go test ./... -v -race -count=1` — expect all PASS.
- [ ] Run: `grep -rn "investigating\.\.\." system-components/holmes` — expect no matches (old ack message text fully removed).
