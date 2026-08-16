# holmes Issue Thread-Link and Severity-Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When holmes creates a GitHub issue from a Slack thread, include a permalink back to that thread in the issue body, and apply a severity label when the thread's Alertmanager-origin context makes one identifiable.

**Architecture:** This extends the already-shipped GitHub-issue-creation feature (`internal/clients/github`, `internal/clients/holmes.Chat`, `internal/handlers/slack`). `internal/clients/github.CreateIssue` gains a `labels []string` parameter. `internal/clients/slack` gains `GetPermalink`, wrapping Slack's `chat.getPermalink`. `issueIntentInstructions` gains an optional `severity` field that HolmesGPT populates only when it can extract one from the thread's existing content (e.g., an Alertmanager-origin notification already present in the thread) — never invented. The Slack handler appends the thread permalink to the issue body and, when `severity` is non-empty, passes it straight through as a label with no allowlist filtering — HolmesGPT is asked to extract an existing value, not invent one, so filtering it would only risk silently dropping a legitimate value.

**Tech Stack:** Go 1.24 (stdlib only, per the existing constraint — `go.mod` still has zero `require` entries).

## Global Constraints

- No third-party Go dependencies.
- Code elements (names, comments, commit messages) in English.
- `git commit -s`, no `Co-Authored-By`.
- No allowlist/validation on the `severity` value — pass whatever non-empty string HolmesGPT extracts straight through as a label name. (Confirmed via a live test against `panicboat/platform`'s issue-labels endpoint: GitHub's REST API auto-creates a label if the name doesn't already exist in the repo, rather than erroring — so there is no failure mode from an unexpected value; filtering would only add a way to silently lose a legitimate severity.)
- No fixed `holmes` marker label — the issue's `author` field (`app/holmes-issue-bot`, already true for every issue holmes creates, since it uses the GitHub App's own identity) already provides that signal via `author:app/holmes-issue-bot` search, so a label would be redundant.
- The thread-permalink append and severity-label application both apply only in the `ready: true` (issue-creation) path — never on the `ready: false` confirmation-request message.
- If `GetPermalink` fails, log it and continue creating the issue without a thread-link line — this is a secondary enhancement, not a reason to fail the whole issue-creation flow (matches the existing codebase pattern: `ConversationsReplies` failures in `handleMention` are logged and the investigation proceeds anyway).
- Design context (not part of this repo — background only): `docs/superpowers/specs/2026-08-17-holmes-github-issue-design.md` (panicboat/platform repo) covers the original issue-creation feature this plan extends.

---

## Task 1: `CreateIssue` accepts labels

**Files:**
- Modify: `system-components/holmes/workspace/internal/clients/github/client.go`
- Modify: `system-components/holmes/workspace/internal/clients/github/client_test.go`

**Interfaces:**
- Produces: `func (c *Client) CreateIssue(repo, title, body string, labels []string) (string, error)` — the exact signature Task 4 calls. A `nil` or empty `labels` slice must omit the JSON field entirely or send an empty array — either way, GitHub must not receive a spurious label.

- [ ] **Step 1: Update the failing tests**

In `system-components/holmes/workspace/internal/clients/github/client_test.go`, find:

```go
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
```

Note this test's `gotIssueBody` is currently typed `map[string]string`, which can't hold a `labels` array — it needs to become `map[string]any`. Replace the whole block (including the earlier `var gotIssueBody map[string]string` declaration a few lines up in the same test) — find:

```go
	var tokenRequests int
	var gotJWTAuth, gotInstallationAuth string
	var gotIssueBody map[string]string
```

replace with:

```go
	var tokenRequests int
	var gotJWTAuth, gotInstallationAuth string
	var gotIssueBody map[string]any
```

then replace the assertions block shown above with:

```go
	url, err := client.CreateIssue("panicboat/monorepo", "found a bug", "details here", []string{"critical"})
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
	gotLabels, ok := gotIssueBody["labels"].([]any)
	if !ok || len(gotLabels) != 1 || gotLabels[0] != "critical" {
		t.Errorf("expected labels [\"critical\"] in the request body, got: %+v", gotIssueBody["labels"])
	}
	if tokenRequests != 1 {
		t.Errorf("expected exactly 1 token-exchange request, got %d", tokenRequests)
	}
}
```

Also update the other two `CreateIssue` call sites in this file (they pass no labels — use `nil`) — find:

```go
	if _, err := client.CreateIssue("panicboat/monorepo", "t1", "b1"); err != nil {
		t.Fatalf("unexpected error on first call: %v", err)
	}
	if _, err := client.CreateIssue("panicboat/monorepo", "t2", "b2"); err != nil {
		t.Fatalf("unexpected error on second call: %v", err)
	}
```

replace with:

```go
	if _, err := client.CreateIssue("panicboat/monorepo", "t1", "b1", nil); err != nil {
		t.Fatalf("unexpected error on first call: %v", err)
	}
	if _, err := client.CreateIssue("panicboat/monorepo", "t2", "b2", nil); err != nil {
		t.Fatalf("unexpected error on second call: %v", err)
	}
```

and find:

```go
	if _, err := client.CreateIssue("panicboat/does-not-exist", "t", "b"); err == nil {
		t.Fatal("expected an error for a 404 response, got nil")
	}
```

replace with:

```go
	if _, err := client.CreateIssue("panicboat/does-not-exist", "t", "b", nil); err == nil {
		t.Fatal("expected an error for a 404 response, got nil")
	}
```

Then add one new test, after `TestClient_CreateIssue_Success`, proving a nil/empty `labels` sends no `labels` field at all (not an empty array — some GitHub API consumers may treat an explicit empty array differently, so the cleanest contract is "omit entirely when there's nothing to send"):

```go
func TestClient_CreateIssue_NoLabels(t *testing.T) {
	var gotIssueBody map[string]any

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/app/installations/999/access_tokens":
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{
				"token":      "installation-token",
				"expires_at": "2099-01-01T00:00:00Z",
			})
		case r.URL.Path == "/repos/panicboat/monorepo/issues":
			json.NewDecoder(r.Body).Decode(&gotIssueBody)
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

	if _, err := client.CreateIssue("panicboat/monorepo", "t", "b", nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, present := gotIssueBody["labels"]; present {
		t.Errorf("expected no \"labels\" field in the request body when labels is nil, got: %+v", gotIssueBody["labels"])
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/github/... -v`
Expected: FAIL (build failure — `CreateIssue` doesn't accept a 4th argument yet).

- [ ] **Step 3: Update `CreateIssue`**

In `system-components/holmes/workspace/internal/clients/github/client.go`, find:

```go
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
```

Replace with:

```go
type createIssueRequest struct {
	Title  string   `json:"title"`
	Body   string   `json:"body"`
	Labels []string `json:"labels,omitempty"`
}

type createIssueResponse struct {
	HTMLURL string `json:"html_url"`
}

func (c *Client) CreateIssue(repo, title, body string, labels []string) (string, error) {
	token, err := c.installationToken()
	if err != nil {
		return "", fmt.Errorf("get installation token: %w", err)
	}

	reqBody, err := json.Marshal(createIssueRequest{Title: title, Body: body, Labels: labels})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}
```

(`omitempty` on `Labels` handles both `nil` and an empty non-nil slice by omitting the field — Go's `encoding/json` treats a zero-length slice as empty for `omitempty` purposes, so this satisfies `TestClient_CreateIssue_NoLabels` regardless of which one Task 4 ends up passing.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/github/... -v`
Expected: PASS — all 5 tests (`TestNew_InvalidPrivateKey`, `TestClient_CreateIssue_Success`, `TestClient_CreateIssue_NoLabels`, `TestClient_CreateIssue_TokenCachedAcrossCalls`, `TestClient_CreateIssue_GitHubError`).

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/workspace/internal/clients/github/
git commit -s -m "feat(holmes): let CreateIssue attach labels"
```

---

## Task 2: `GetPermalink` on the Slack client

**Files:**
- Modify: `system-components/holmes/workspace/internal/clients/slack/api.go`
- Modify: `system-components/holmes/workspace/internal/clients/slack/api_test.go`

**Interfaces:**
- Produces: `func (c *Client) GetPermalink(channel, ts string) (string, error)` — the exact signature Task 4 calls.

- [ ] **Step 1: Write the failing test**

Read `system-components/holmes/workspace/internal/clients/slack/api_test.go` first to match its existing style (server setup, assertions) exactly — it already has tests for `PostMessage`, `ConversationsReplies`, and `ConversationsHistory` following one consistent pattern (an `httptest.Server` stub keyed by `r.URL.Path`, a `slack.Client` pointed at it via `BaseURL`). Add a new test in the same style:

```go
func TestClient_GetPermalink(t *testing.T) {
	var gotChannel, gotTs string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat.getPermalink" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		gotChannel = r.URL.Query().Get("channel")
		gotTs = r.URL.Query().Get("message_ts")
		json.NewEncoder(w).Encode(map[string]any{
			"ok":        true,
			"channel":   gotChannel,
			"permalink": "https://panicboat.slack.com/archives/C123/p1234567890123456",
		})
	}))
	defer server.Close()

	client := &Client{BotToken: "xoxb-test", BaseURL: server.URL, HTTPClient: &http.Client{}}

	permalink, err := client.GetPermalink("C123", "1234567890.123456")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if permalink != "https://panicboat.slack.com/archives/C123/p1234567890123456" {
		t.Errorf("got permalink %q, want the stubbed URL", permalink)
	}
	if gotChannel != "C123" {
		t.Errorf("expected channel=C123 query param, got %q", gotChannel)
	}
	if gotTs != "1234567890.123456" {
		t.Errorf("expected message_ts=1234567890.123456 query param, got %q", gotTs)
	}
}

func TestClient_GetPermalink_Error(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "message_not_found"})
	}))
	defer server.Close()

	client := &Client{BotToken: "xoxb-test", BaseURL: server.URL, HTTPClient: &http.Client{}}

	if _, err := client.GetPermalink("C123", "999.999"); err == nil {
		t.Fatal("expected an error, got nil")
	}
}
```

If `api_test.go` doesn't already import `encoding/json`, `net/http`, `net/http/httptest`, and `testing`, add them — but it almost certainly already does, since it tests the same-shaped `PostMessage`/`ConversationsReplies` methods.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/slack/... -v -run TestClient_GetPermalink`
Expected: FAIL (build failure — `GetPermalink` doesn't exist yet).

- [ ] **Step 3: Implement `GetPermalink`**

In `system-components/holmes/workspace/internal/clients/slack/api.go`, find:

```go
func (c *Client) getMessages(url string) ([]Message, error) {
```

Insert immediately before it:

```go
// GetPermalink returns a shareable URL for the message at ts in channel,
// via Slack's chat.getPermalink. Used to link a created GitHub issue back
// to the Slack thread it came from.
func (c *Client) GetPermalink(channel, ts string) (string, error) {
	url := fmt.Sprintf("%s/chat.getPermalink?channel=%s&message_ts=%s",
		c.BaseURL, neturl.QueryEscape(channel), neturl.QueryEscape(ts))

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.BotToken)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call slack api: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK        bool   `json:"ok"`
		Error     string `json:"error"`
		Permalink string `json:"permalink"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return "", fmt.Errorf("slack api error: %s", result.Error)
	}
	return result.Permalink, nil
}

```

(This mirrors `getMessages`'s existing structure — a GET request, bearer auth, `ok`/`error` envelope check — but returns a single string field instead of a `[]Message`, so it isn't a good fit for the `getMessages` helper itself.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/slack/... -v`
Expected: PASS — all tests in the package, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/workspace/internal/clients/slack/
git commit -s -m "feat(holmes): add GetPermalink to the Slack client"
```

---

## Task 3: `severity` in the issue-intent envelope

**Files:**
- Modify: `system-components/holmes/workspace/internal/clients/holmes/client.go`
- Modify: `system-components/holmes/workspace/internal/clients/holmes/client_test.go`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: `issueIntentInstructions` (already exists) now also documents an optional `severity` field in the JSON envelope it asks HolmesGPT to emit — Task 4's `issueAction` struct (in a different package) must add a matching `Severity string \`json:"severity"\`` field with the same JSON key.

- [ ] **Step 1: Write the failing test**

In `system-components/holmes/workspace/internal/clients/holmes/client_test.go`, find `TestClient_Chat` and its assertion block:

```go
		if !strings.Contains(req.AdditionalSystemPrompt, "create_issue") {
			t.Errorf("expected Chat's additional_system_prompt to include issue-detection instructions, got: %q", req.AdditionalSystemPrompt)
		}
```

Add immediately after it (still inside the same handler function, before `json.NewEncoder(w).Encode(...)`):

```go
		if !strings.Contains(req.AdditionalSystemPrompt, "severity") {
			t.Errorf("expected Chat's additional_system_prompt to mention severity extraction, got: %q", req.AdditionalSystemPrompt)
		}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/holmes/... -v -run TestClient_Chat$`
Expected: FAIL — `issueIntentInstructions` doesn't mention "severity" yet.

- [ ] **Step 3: Extend `issueIntentInstructions`**

In `system-components/holmes/workspace/internal/clients/holmes/client.go`, find:

```go
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
```

Replace with:

```go
const issueIntentInstructions = `Additionally, decide whether the message (in the context of the
full thread above) requests creating a GitHub issue.

If it does not, ignore the rest of this section and respond exactly as instructed above.

If it does, respond with ONLY this JSON object and nothing else — no surrounding text, no
mrkdwn, no code fence:
{"action":"create_issue","repo":"owner/repo","title":"...","body":"...","ready":true,"reason":"...","severity":"..."}

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
  this repo, so the user can judge whether to confirm it. Omit when ready is true.
- "severity": only when ready is true, and only if a severity value is already present
  somewhere in this thread (for example, an Alertmanager notification's severity label or
  a mention of "critical"/"warning" in the conversation). Copy that existing value exactly
  — never invent or guess one. Omit entirely if the thread contains no severity signal.`
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/holmes/... -v`
Expected: PASS — all tests in the package.

- [ ] **Step 5: Commit**

```bash
git add system-components/holmes/workspace/internal/clients/holmes/
git commit -s -m "feat(holmes): extend issue-intent envelope with severity"
```

---

## Task 4: Wire thread-link and severity label into the Slack handler

**Files:**
- Modify: `system-components/holmes/workspace/internal/handlers/slack/handler.go`
- Modify: `system-components/holmes/workspace/internal/handlers/slack/handler_test.go`

**Interfaces:**
- Consumes: `github.Client.CreateIssue(repo, title, body string, labels []string) (string, error)` (Task 1), `slack.Client.GetPermalink(channel, ts string) (string, error)` (Task 2), `issueIntentInstructions`'s `severity` field (Task 3, JSON key `"severity"`).
- Produces: nothing downstream — last task.

- [ ] **Step 1: Update the failing tests**

In `system-components/holmes/workspace/internal/handlers/slack/handler_test.go`, the `messagePoster` fake needs a `GetPermalink` method now that the interface requires it (Step 3 below adds `GetPermalink` to `messagePoster`). This file's existing tests construct `Client: &slackclient.Client{...}` — the real concrete type — for every test, not a hand-rolled fake, so once Task 2's `GetPermalink` exists on `*slackclient.Client`, those existing tests automatically satisfy the wider interface with no test-file changes needed *except* for the tests that now exercise `handleIssueAction`'s `ready: true` path, which must also stub a `/chat.getPermalink` response on their `slackServer`, or `GetPermalink` will hit an unhandled path and the test's `default: t.Errorf(...)` case will fail it.

Find `TestHandleMention_CreateIssue_ReadyTrue`:

```go
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
```

Replace with (adds a `/chat.getPermalink` case to the slack stub, and asserts the permalink lands in the body passed to `CreateIssue` and that no label is sent when `severity` is absent from the envelope):

```go
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
			"analysis": `{"action":"create_issue","repo":"panicboat/monorepo","title":"bug title","body":"bug body","ready":true}`,
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
		t.Errorf("expected no labels when the envelope has no severity, got: %v", gotLabels)
	}
	final := posted[len(posted)-1]
	if !strings.Contains(final["text"], "https://github.com/panicboat/monorepo/issues/42") {
		t.Errorf("expected the final post to contain the issue URL, got: %+v", final)
	}
}
```

Find `fakeGitHub` and update its signature to match Task 1's new `CreateIssue`:

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
```

Replace with:

```go
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
```

Find the other three `createIssueFunc` closures (in `TestHandleMention_CreateIssue_ReadyFalse`, `TestHandleMention_CreateIssue_GitHubError`, `TestHandleMention_CreateIssue_CodeFenceWrapped`) and update each closure's signature to match — for example, find:

```go
	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string) (string, error) {
		t.Fatal("CreateIssue must not be called when ready is false")
		return "", nil
	}}
```

replace with:

```go
	gh := &fakeGitHub{createIssueFunc: func(repo, title, body string, labels []string) (string, error) {
		t.Fatal("CreateIssue must not be called when ready is false")
		return "", nil
	}}
```

and find the two other occurrences of `createIssueFunc: func(repo, title, body string) (string, error) {` (in `TestHandleMention_CreateIssue_GitHubError` and `TestHandleMention_CreateIssue_CodeFenceWrapped`) and change each to `createIssueFunc: func(repo, title, body string, labels []string) (string, error) {` with the body of each closure otherwise unchanged. These three tests' `slackServer` stubs don't need a `/chat.getPermalink` case added — `TestHandleMention_CreateIssue_ReadyFalse` never reaches the issue-creation path at all (`GetPermalink` is only called when `ready: true`), and `TestHandleMention_CreateIssue_GitHubError`/`_CodeFenceWrapped` already handle every request generically (their `slackServer` handlers don't switch on path), so a `/chat.getPermalink` request lands in the same generic branch as any other and gets `{"ok": true}` back — harmless, since these tests don't assert on the permalink.

Then add one new test, after `TestHandleMention_CreateIssue_ReadyTrue`, covering the severity-to-label path:

```go
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
			"analysis": `{"action":"create_issue","repo":"panicboat/platform","title":"t","body":"b","ready":true,"severity":"critical"}`,
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
```

- [ ] **Step 2: Run the tests to verify the new/changed ones fail**

Run: `cd system-components/holmes/workspace && go test ./internal/handlers/slack/... -v`
Expected: FAIL (build failure — `messagePoster` doesn't require `GetPermalink` yet, `issueAction` has no `Severity` field, `handleIssueAction` doesn't call `CreateIssue` with 4 args).

- [ ] **Step 3: Update the handler**

In `system-components/holmes/workspace/internal/handlers/slack/handler.go`, find:

```go
type issueCreator interface {
	CreateIssue(repo, title, body string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
}
```

Replace with:

```go
type issueCreator interface {
	CreateIssue(repo, title, body string, labels []string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
	GetPermalink(channel, ts string) (string, error)
}
```

Find:

```go
type issueAction struct {
	Action string `json:"action"`
	Repo   string `json:"repo"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	Ready  bool   `json:"ready"`
	Reason string `json:"reason"`
}
```

Replace with:

```go
type issueAction struct {
	Action   string `json:"action"`
	Repo     string `json:"repo"`
	Title    string `json:"title"`
	Body     string `json:"body"`
	Ready    bool   `json:"ready"`
	Reason   string `json:"reason"`
	Severity string `json:"severity"`
}
```

Find:

```go
	url, err := h.GitHub.CreateIssue(action.Repo, action.Title, action.Body)
	if err != nil {
		if _, postErr := h.Client.PostMessage(channel, threadTs, fmt.Sprintf("issue creation failed: %v", err)); postErr != nil {
			log.Printf("failed to post issue creation error: %v", postErr)
		}
		return
	}
```

Replace with:

```go
	body := action.Body
	if permalink, err := h.Client.GetPermalink(channel, threadTs); err != nil {
		log.Printf("failed to get thread permalink: %v", err)
	} else {
		body = fmt.Sprintf("%s\n\n---\n**元スレッド:** %s", body, permalink)
	}

	var labels []string
	if action.Severity != "" {
		labels = []string{action.Severity}
	}

	url, err := h.GitHub.CreateIssue(action.Repo, action.Title, body, labels)
	if err != nil {
		if _, postErr := h.Client.PostMessage(channel, threadTs, fmt.Sprintf("issue creation failed: %v", err)); postErr != nil {
			log.Printf("failed to post issue creation error: %v", postErr)
		}
		return
	}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd system-components/holmes/workspace && go test ./internal/handlers/slack/... -v`
Expected: PASS — all tests in the package, including every pre-existing test (they use the real `*slackclient.Client`, which now satisfies the wider `messagePoster` interface automatically once Task 2 is merged) and the new/updated ones.

- [ ] **Step 5: Build the whole module**

Run: `cd system-components/holmes/workspace && go build ./... && go vet ./... && go test ./... -race`
Expected: builds clean, vet clean, all packages PASS. (This task doesn't touch `main.go` — `github.New`'s and `slack.New`'s own signatures are unchanged, only methods on the resulting clients gained functionality — so a package-scoped check would already be sufficient, but the whole-module run costs little and catches anything unexpected.)

- [ ] **Step 6: Commit**

```bash
git add system-components/holmes/workspace/internal/handlers/slack/
git commit -s -m "feat(holmes): link created issues back to their Slack thread and label by severity"
```

---

## Task 5: Open Draft PR

**Files:** none (git/GitHub operations only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/holmes-issue-link-severity
```

- [ ] **Step 2: Open a Draft PR**

```bash
gh pr create --draft --title "feat(system-components/holmes): link issues to their Slack thread and label by severity" --body "$(cat <<'EOF'
## Summary
- `internal/clients/github.CreateIssue` now accepts `labels []string`.
- New `internal/clients/slack.GetPermalink`, wrapping `chat.getPermalink`.
- `issueIntentInstructions` gains an optional `severity` field — HolmesGPT extracts it from existing thread content (e.g. an Alertmanager notification already in the thread) when present, never invents one.
- The Slack handler appends the thread's permalink to the issue body and, when `severity` is present, passes it straight through as a label with no allowlist filtering (confirmed live: GitHub's issues API auto-creates unknown label names rather than erroring, so filtering would only risk silently dropping a legitimate value).
- No fixed `holmes` marker label — the issue's `author` (`app/holmes-issue-bot`) already signals that.

## Test plan
- [x] `go build ./... && go vet ./... && go test ./... -race` — all pass
- [ ] After merge and release: create an issue via Slack and confirm the body ends with a working thread-permalink line
- [ ] Create an issue from a thread containing an Alertmanager-origin severity and confirm the resulting issue carries that severity as a label
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Self-Review Notes

- **Spec coverage**: thread-permalink append (Task 4), optional `severity` extraction (Task 3) with no allowlist (Global Constraints, Task 4), no fixed `holmes` label (Global Constraints — no task adds one) are all covered.
- **Placeholder scan**: none — all code blocks are complete.
- **Type/naming consistency**: `issueAction.Severity` (Task 4, `json:"severity"`) matches the field name `issueIntentInstructions` (Task 3) tells HolmesGPT to emit. `CreateIssue`'s signature is identical everywhere it's defined (Task 1) and called (Task 4, and the test-file updates in Task 4 Step 1).
- **Scope boundary**: no `panicboat/platform` changes — this is a monorepo-only extension of the already-shipped, monorepo-only issue-creation feature. `main.go` is untouched (Task 4 Step 5 notes why).
- **Cross-task risk called out for the implementer**: Task 4 Step 1 explicitly warns that `fakeGitHub`'s signature change (from Task 1's `CreateIssue` signature change) ripples into three other existing tests beyond `TestHandleMention_CreateIssue_ReadyTrue` — each closure must be updated or the package won't build. This was verified against the actual current file contents before writing this plan, not assumed.
