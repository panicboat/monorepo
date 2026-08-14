package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHolmesClient_Investigate(t *testing.T) {
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

	client := NewHolmesClient(server.URL, "sonnet-4-6")
	analysis, err := client.Investigate("why is pod crashing")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if analysis != "root cause found" {
		t.Errorf("got %q, want %q", analysis, "root cause found")
	}
}

func TestHolmesClient_Investigate_ErrorStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewHolmesClient(server.URL, "sonnet-4-6")
	if _, err := client.Investigate("test"); err == nil {
		t.Fatal("expected error, got nil")
	}
}
