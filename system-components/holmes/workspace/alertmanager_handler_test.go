package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAlertmanagerHandler_Unauthorized(t *testing.T) {
	h := &alertmanagerHandler{cfg: Config{AlertmanagerToken: "secret-token"}}
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook?channel=test", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Authorization", "Bearer wrong-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestAlertmanagerHandler_MissingChannel(t *testing.T) {
	h := &alertmanagerHandler{cfg: Config{AlertmanagerToken: "secret-token"}}
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook", bytes.NewReader([]byte(`{"alerts":[]}`)))
	req.Header.Set("Authorization", "Bearer secret-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestAlertmanagerHandler_Accepted(t *testing.T) {
	// h.holmes and h.client must be real (non-nil) here: ServeHTTP spawns
	// investigateAlert in a goroutine, and a nil-pointer panic inside a
	// goroutine crashes the whole test binary, not just this test.
	posted := make(chan string, 1)

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(holmesChatResponse{Analysis: "found the cause"})
	}))
	defer holmesServer.Close()

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted <- body["text"]
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer slackServer.Close()

	slackClient := newSlackAPIClient("xoxb-test")
	slackClient.BaseURL = slackServer.URL

	h := &alertmanagerHandler{
		cfg:    Config{AlertmanagerToken: "secret-token"},
		holmes: NewHolmesClient(holmesServer.URL, "sonnet-4-6"),
		client: slackClient,
	}
	body := []byte(`{"alerts":[{"status":"firing","labels":{"alertname":"KubePodCrashLooping","severity":"critical"},"annotations":{"summary":"pod is crash looping"}}]}`)
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook?channel=incidents", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer secret-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want %d", w.Code, http.StatusOK)
	}

	select {
	case text := <-posted:
		if !strings.Contains(text, "found the cause") {
			t.Errorf("expected posted text to contain the analysis, got: %s", text)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for holmes to post to Slack")
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
