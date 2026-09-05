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

func TestClient_ConversationsHistory_WithAttachments(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{
			"ok": true,
			"messages": [
				{
					"text": "",
					"ts": "1786859390.110479",
					"attachments": [
						{"text": "*HolmesE2ETest4* fingerprint: ` + "`" + `e3be599194200b94` + "`" + `"}
					]
				}
			]
		}`))
	}))
	defer server.Close()

	c := New("xoxb-test")
	c.BaseURL = server.URL
	msgs, err := c.ConversationsHistory("C123", "1700000000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}
	if len(msgs[0].Attachments) != 1 {
		t.Fatalf("expected 1 attachment, got %d", len(msgs[0].Attachments))
	}
	if !strings.Contains(msgs[0].Attachments[0].Text, "e3be599194200b94") {
		t.Errorf("expected attachment text to contain the fingerprint, got: %q", msgs[0].Attachments[0].Text)
	}
}

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
