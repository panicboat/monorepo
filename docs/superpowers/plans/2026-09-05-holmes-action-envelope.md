# Holmes Action Envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `create_issue`-only flat action struct with an extensible `{action, ready, reason, payload}` envelope, move prompt text out of Go string constants into embedded files, and make action-parsing failures visible instead of silently falling back to plain-text.

**Architecture:** `internal/clients/holmes/client.go` embeds prompt text from `internal/clients/holmes/prompts/*.md` instead of holding it in Go string constants, and the `create_issue` prompt is rewritten to describe the new envelope shape. `internal/handlers/slack/handler.go` parses HolmesGPT's response into a common `actionEnvelope` (action name + ready/reason + raw payload), decodes the payload into an action-specific struct only once the action name is known, and dispatches via a `switch`. An empty `action` field means "plain analysis, post as-is"; a known action with an undecodable payload, or an unrecognized action name, now posts a visible error instead of silently falling through to posting the raw JSON as text.

**Tech Stack:** Go 1.24, stdlib `embed` + `encoding/json`, `net/http/httptest` for tests (existing patterns).

**Spec:** `docs/superpowers/specs/2026-09-05-holmes-action-architecture-design.md`, sections "2. Action envelope", "3. 実行ディスパッチ", "4. Prompt 管理", "5. 判定精度・安定性"

## Global Constraints

- No interface change to `Chat`/`Investigate` (`internal/clients/holmes.Client`) — same signatures, same callers.
- `Investigate` (used by the Alertmanager relay) must never receive the `create_issue` prompt section — `TestClient_Investigate_NoIssueInstructions` already enforces this and must keep passing unmodified.
- Action dispatch stays a `switch` statement, not an interface+registry — only one action (`create_issue`) exists today; YAGNI per AGENTS.md.
- No behavior change to the `create_issue` flow itself (confirmation message wording, severity→label mapping, permalink-in-body, GitHub error reporting) — only its wire format and internal representation change.
- This plan does not touch the `🔍 investigating...` acknowledgement message — that's a separate plan (Investigating UX).

---

## File Structure

- Create: `system-components/holmes/internal/clients/holmes/prompts/formatting.md`
- Create: `system-components/holmes/internal/clients/holmes/prompts/create_issue.md`
- Modify: `system-components/holmes/internal/clients/holmes/client.go`
- Modify: `system-components/holmes/internal/clients/holmes/client_test.go`
- Modify: `system-components/holmes/internal/handlers/slack/handler.go`
- Modify: `system-components/holmes/internal/handlers/slack/handler_test.go`

---

### Task 1: Move prompt text into embedded Markdown files, rewrite for the envelope shape

**Files:**
- Create: `system-components/holmes/internal/clients/holmes/prompts/formatting.md`
- Create: `system-components/holmes/internal/clients/holmes/prompts/create_issue.md`
- Modify: `system-components/holmes/internal/clients/holmes/client.go`
- Modify: `system-components/holmes/internal/clients/holmes/client_test.go`

**Interfaces:**
- Consumes: nothing new
- Produces: `Client.Chat(ask string) (string, error)` now sends an `additional_system_prompt` whose `create_issue` section describes `{"action":"create_issue","ready":true,"reason":"...","payload":{"repo":"...","title":"...","body":"...","severity":"..."}}` instead of the old flat shape. Task 2's `actionEnvelope`/`createIssuePayload` structs must match this exact shape (`payload.repo`, `payload.title`, `payload.body`, `payload.severity`; `action`, `ready`, `reason` at the top level).

- [ ] **Step 1: Write the failing assertion**

In `system-components/holmes/internal/clients/holmes/client_test.go`, inside `TestClient_Chat`'s handler func, add this check after the existing `severity` check (around line 92, right before `json.NewEncoder(w).Encode(...)`):

```go
		if !strings.Contains(req.AdditionalSystemPrompt, "payload") {
			t.Errorf("expected Chat's additional_system_prompt to describe the payload envelope, got: %q", req.AdditionalSystemPrompt)
		}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd system-components/holmes && go test ./internal/clients/holmes/... -run TestClient_Chat -v`
Expected: FAIL — `expected Chat's additional_system_prompt to describe the payload envelope` (the current `issueIntentInstructions` constant has no `payload` field).

- [ ] **Step 3: Create `prompts/formatting.md`**

```markdown
Respond in Japanese.

Format your response using Slack's mrkdwn syntax, not standard Markdown:
- Bold: *text* (single asterisks, not **text**)
- No markdown headings (#, ##, ###) — use *bold* text as a section label instead
- Links: <https://example.com|link text>, not [link text](https://example.com)
- Bullet lists: start each line with "• " (not "- " or "* ")

For root cause investigation, you have read-only access to two source repositories via
git (both public, no authentication needed):
- https://github.com/panicboat/monorepo
- https://github.com/panicboat/platform

Investigate cluster state first (logs, metrics, resource status). Only clone and read
source code when cluster state alone doesn't explain the root cause — for example, when
a bug or misconfiguration appears to originate in application code rather than runtime
state.
```

- [ ] **Step 4: Create `prompts/create_issue.md`**

```markdown
Additionally, decide whether the message (in the context of the
full thread above) requests creating a GitHub issue.

If it does not, ignore the rest of this section and respond exactly as instructed above.

If it does, respond with ONLY this JSON object and nothing else — no
surrounding text, no mrkdwn, no code fence:
{"action":"create_issue","ready":true,"reason":"...","payload":{"repo":"owner/repo","title":"...","body":"...","severity":"..."}}

- "payload.repo": the target repository. Use the repository the user explicitly named in
  their message. If they did not name one, infer it from the investigation context (for
  example, where source-investigation located the relevant code).
- "ready": true if the user explicitly named the repo, or if the thread shows they already
  confirmed a repo you previously proposed. false if you inferred the repo and it has not
  yet been confirmed.
- "payload.title", "payload.body": required only when ready is true. Synthesize them from
  the full investigation in this thread — do not just copy the single most recent message.
  "payload.body" must use standard GitHub Markdown (headings with #, **bold**,
  [text](url) links, "- " bullets), not Slack mrkdwn, since it becomes a GitHub issue body.
- "reason": required only when ready is false — a short explanation of why you inferred
  this repo, so the user can judge whether to confirm it. Omit when ready is true.
- "payload.severity": only when ready is true, and only if a severity value is already
  present somewhere in this thread (for example, an Alertmanager notification's severity
  label or a mention of "critical"/"warning" in the conversation). Copy that existing
  value exactly — never invent or guess one. Omit entirely if the thread contains no
  severity signal.
```

- [ ] **Step 5: Update `client.go` to embed and use the prompt files**

In `system-components/holmes/internal/clients/holmes/client.go`, replace the `slackFormattingInstructions` and `issueIntentInstructions` const declarations (and their doc comments) with:

```go
// formattingPrompt is sent as HolmesGPT's additional_system_prompt on
// every request. HolmesGPT's default output is standard Markdown and
// English; holmes relays the response into Slack chat.postMessage
// verbatim with no reformatting, so it must ask HolmesGPT to produce
// Slack's mrkdwn dialect directly (Slack does not render **bold**,
// #-headings, or [text](url) links) and to respond in Japanese, the
// team's operating language. It also names the two source repositories
// HolmesGPT can read via its bash toolset's git allowlist (see
// panicboat/platform's kubernetes/components/holmesgpt component) —
// HolmesGPT has no other way to learn these repos exist or when to use
// them.
//
//go:embed prompts/formatting.md
var formattingPrompt string

// createIssuePrompt is appended to Chat's additional_system_prompt only
// (never Investigate's — Alertmanager's fixed alert-investigation ask
// never carries human issue-creation intent, so keeping this off that
// path means it can never receive or need to parse a create_issue
// envelope).
//
//go:embed prompts/create_issue.md
var createIssuePrompt string
```

A `//go:embed` directive requires the `embed` package to be imported in the file, even though `formattingPrompt`/`createIssuePrompt` are typed `string` (not `embed.FS`). Since nothing in this file references `embed.FS` directly, import it blank. Update the import block at the top of the file to:

```go
import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)
```

Update `Investigate` and `Chat` to reference the new variable names:

```go
func (c *Client) Investigate(ask string) (string, error) {
	return c.chat(ask, formattingPrompt)
}

// Chat is used by the Slack mention flow — same request/response shape as
// Investigate, but its additional_system_prompt also asks HolmesGPT to
// detect action intent (see createIssuePrompt).
func (c *Client) Chat(ask string) (string, error) {
	return c.chat(ask, formattingPrompt+"\n\n"+createIssuePrompt)
}
```

Leave every other declaration in the file (`Client`, `New`, `holmesChatRequest`, `holmesChatResponse`, `chat`) unchanged.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd system-components/holmes && go test ./internal/clients/holmes/... -v`
Expected: PASS — all tests including the new `payload` assertion, and `TestClient_Investigate_NoIssueInstructions` still passes (formatting.md has no mention of `create_issue`).

- [ ] **Step 7: Commit**

```bash
git add system-components/holmes/internal/clients/holmes
git commit -s -m "refactor(system-components/holmes): embed holmes prompts and describe the action payload envelope"
```

---

### Task 2: Replace the flat `issueAction` struct with an `{action, ready, reason, payload}` envelope and switch dispatch

**Files:**
- Modify: `system-components/holmes/internal/handlers/slack/handler.go`
- Modify: `system-components/holmes/internal/handlers/slack/handler_test.go`

**Interfaces:**
- Consumes: `Client.Chat` (Task 1, now describes the envelope shape in its prompt — behavior at the Go layer is unaffected since `Chat` still just returns the raw response string)
- Produces: `actionEnvelope{Action, Ready, Reason string; Payload json.RawMessage}`, `createIssuePayload{Repo, Title, Body, Severity string}`. Any future action task adds a new payload struct and a new `case` in `dispatchAction` — it does not touch `parseActionEnvelope` or the `ready`/`reason` confirmation logic.

- [ ] **Step 1: Rewrite `handler_test.go` for the envelope shape and add error-path coverage**

Replace the full contents of `system-components/holmes/internal/handlers/slack/handler_test.go`:

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

func TestHandleMention_ChatFailure(t *testing.T) {
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
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted = append(posted, body)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
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
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted = append(posted, body)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
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
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted = append(posted, body)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
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
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted = append(posted, body)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
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
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted = append(posted, body)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
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

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `cd system-components/holmes && go test ./internal/handlers/slack/... -v`
Expected: FAIL — `TestHandleMention_CreateIssue_*` fail because the current `issueAction` struct has no `payload` field (so `Repo`/`Title`/`Body`/`Severity` all decode empty from the new envelope shape), and `TestHandleMention_UnknownAction`/`TestHandleMention_MalformedCreateIssuePayload` fail because the current code silently posts the raw response text instead of an error message.

- [ ] **Step 3: Rewrite `handler.go`**

Replace the full contents of `system-components/holmes/internal/handlers/slack/handler.go`:

```go
package slack

import (
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
	Chat(ask string) (string, error)
}

type issueCreator interface {
	CreateIssue(repo, title, body string, labels []string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
	GetPermalink(channel, ts string) (string, error)
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

// actionEnvelope is the common wrapper HolmesGPT returns when it decides
// a message requests an action, instead of a plain analysis. Action is
// empty when the response is a plain analysis — callers check that
// before treating the rest of the envelope as meaningful. Payload stays
// raw until the action name is known, so each action's fields live in
// their own struct instead of piling into one shared one.
type actionEnvelope struct {
	Action  string          `json:"action"`
	Ready   bool            `json:"ready"`
	Reason  string          `json:"reason"`
	Payload json.RawMessage `json:"payload"`
}

type createIssuePayload struct {
	Repo     string `json:"repo"`
	Title    string `json:"title"`
	Body     string `json:"body"`
	Severity string `json:"severity"`
}

type Handler struct {
	Cfg    config.Config
	Holmes investigator
	Client messagePoster
	GitHub issueCreator
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

	env, ok := parseActionEnvelope(response)
	if !ok {
		if _, err := h.Client.PostMessage(evt.Channel, threadTs, response); err != nil {
			log.Printf("failed to post analysis: %v", err)
		}
		return
	}

	h.dispatchAction(evt.Channel, threadTs, env)
}

// parseActionEnvelope reports ok=false when response carries no action
// field — meaning HolmesGPT judged no action was requested, so response
// is a plain analysis to post as-is rather than an envelope to dispatch.
func parseActionEnvelope(response string) (env actionEnvelope, ok bool) {
	if err := json.Unmarshal([]byte(stripCodeFence(response)), &env); err != nil {
		return actionEnvelope{}, false
	}
	if env.Action == "" {
		return actionEnvelope{}, false
	}
	return env, true
}

func (h *Handler) dispatchAction(channel, threadTs string, env actionEnvelope) {
	switch env.Action {
	case "create_issue":
		h.handleCreateIssue(channel, threadTs, env)
	default:
		log.Printf("unknown action %q from holmes response", env.Action)
		if _, err := h.Client.PostMessage(channel, threadTs, "アクションの解析に失敗しました（不明な action です）"); err != nil {
			log.Printf("failed to post unknown-action message: %v", err)
		}
	}
}

// handleCreateIssue either asks the user to confirm an inferred repo, or
// creates the issue and reports the result — never both.
func (h *Handler) handleCreateIssue(channel, threadTs string, env actionEnvelope) {
	var payload createIssuePayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		log.Printf("failed to decode create_issue payload: %v", err)
		if _, postErr := h.Client.PostMessage(channel, threadTs, "アクションの解析に失敗しました（create_issue の内容が不正です）"); postErr != nil {
			log.Printf("failed to post payload-decode-failure message: %v", postErr)
		}
		return
	}

	if !env.Ready {
		msg := fmt.Sprintf("推定した repo は `%s` です（理由: %s）。作成してよければ「はい」と返信してください。", payload.Repo, env.Reason)
		if _, err := h.Client.PostMessage(channel, threadTs, msg); err != nil {
			log.Printf("failed to post confirmation request: %v", err)
		}
		return
	}

	body := payload.Body
	if permalink, err := h.Client.GetPermalink(channel, threadTs); err != nil {
		// FALLBACK: issue creation must not depend on the optional thread link.
		log.Printf("failed to get thread permalink: %v", err)
	} else {
		body = fmt.Sprintf("%s\n\n---\n**元スレッド:** %s", body, permalink)
	}

	var labels []string
	if payload.Severity != "" {
		labels = []string{payload.Severity}
	}

	url, err := h.GitHub.CreateIssue(payload.Repo, payload.Title, body, labels)
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
// or ``` ... ```), if present. The create_issue prompt instructs HolmesGPT
// not to wrap its JSON envelope in one, but LLMs commonly do anyway — this
// keeps that response parseable instead of failing to detect the action.
func stripCodeFence(s string) string {
	trimmed := strings.TrimSpace(s)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	return strings.TrimSpace(trimmed)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd system-components/holmes && go test ./internal/handlers/slack/... -v`
Expected: PASS — all tests including `TestHandleMention_UnknownAction` and `TestHandleMention_MalformedCreateIssuePayload`.

- [ ] **Step 5: Run the full test suite**

Run: `cd system-components/holmes && go build ./... && go vet ./... && go test ./... -v -race -count=1`
Expected: PASS everywhere (no other package references `issueAction` or the removed constant names).

- [ ] **Step 6: Commit**

```bash
git add system-components/holmes/internal/handlers/slack
git commit -s -m "refactor(system-components/holmes): replace flat issueAction with action envelope + switch dispatch"
```

---

## Final Verification

- [ ] Run: `cd system-components/holmes && go build ./... && go vet ./... && go test ./... -v -race -count=1` — expect all PASS.
- [ ] Run: `grep -rn "issueAction\|slackFormattingInstructions\|issueIntentInstructions" system-components/holmes` — expect no matches (old names fully removed).
