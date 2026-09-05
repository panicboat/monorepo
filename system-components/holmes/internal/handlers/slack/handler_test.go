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
