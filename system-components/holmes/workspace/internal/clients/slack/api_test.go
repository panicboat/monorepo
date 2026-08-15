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
