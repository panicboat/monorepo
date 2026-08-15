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
	"strings"
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

	h := &slackHandler{
		holmes: NewHolmesClient(holmesServer.URL, "test-model"),
		client: &slackAPIClient{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
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
				"messages": []slackMessage{
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

	h := &slackHandler{
		holmes: NewHolmesClient(holmesServer.URL, "test-model"),
		client: &slackAPIClient{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
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

	h := &slackHandler{
		holmes: NewHolmesClient(holmesServer.URL, "test-model"),
		client: &slackAPIClient{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
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

	h := &slackHandler{
		holmes: NewHolmesClient(holmesServer.URL, "test-model"),
		client: &slackAPIClient{BotToken: "xoxb-test", BaseURL: slackServer.URL, HTTPClient: &http.Client{}},
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
