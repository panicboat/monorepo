package holmes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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
		if !strings.Contains(req.AdditionalSystemPrompt, "Japanese") {
			t.Errorf("expected additional_system_prompt to request Japanese, got: %q", req.AdditionalSystemPrompt)
		}
		if !strings.Contains(req.AdditionalSystemPrompt, "mrkdwn") {
			t.Errorf("expected additional_system_prompt to request Slack mrkdwn formatting, got: %q", req.AdditionalSystemPrompt)
		}
		if !strings.Contains(req.AdditionalSystemPrompt, "github.com/panicboat/monorepo") {
			t.Errorf("expected additional_system_prompt to mention the monorepo repo, got: %q", req.AdditionalSystemPrompt)
		}
		if !strings.Contains(req.AdditionalSystemPrompt, "github.com/panicboat/platform") {
			t.Errorf("expected additional_system_prompt to mention the platform repo, got: %q", req.AdditionalSystemPrompt)
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
