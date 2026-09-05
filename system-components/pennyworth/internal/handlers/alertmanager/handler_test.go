package alertmanager

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	holmesgptclient "github.com/panicboat/monorepo/system-components/pennyworth/internal/clients/holmesgpt"
	slackclient "github.com/panicboat/monorepo/system-components/pennyworth/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/pennyworth/internal/config"
)

func TestHandler_Unauthorized(t *testing.T) {
	h := &Handler{Cfg: config.Config{AlertmanagerToken: "secret-token"}}
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook?channel=test", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Authorization", "Bearer wrong-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestHandler_MissingChannel(t *testing.T) {
	h := &Handler{Cfg: config.Config{AlertmanagerToken: "secret-token"}}
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook", bytes.NewReader([]byte(`{"alerts":[]}`)))
	req.Header.Set("Authorization", "Bearer secret-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandler_Accepted(t *testing.T) {
	// h.HolmesGPT and h.Client must be real (non-nil) here: ServeHTTP spawns
	// investigateAlert in a goroutine, and a nil-pointer panic inside a
	// goroutine crashes the whole test binary, not just this test.
	posted := make(chan string, 2)

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"analysis": "found the cause"})
	}))
	defer holmesServer.Close()

	slackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		posted <- body["text"]
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer slackServer.Close()

	slackClient := slackclient.New("xoxb-test")
	slackClient.BaseURL = slackServer.URL

	h := &Handler{
		Cfg:       config.Config{AlertmanagerToken: "secret-token"},
		HolmesGPT: holmesgptclient.New(holmesServer.URL, "sonnet-4-6"),
		Client:    slackClient,
	}
	// No "fingerprint" in the payload, so investigateAlert skips the
	// search and posts a fallback notification before threading the
	// analysis under it — two messages total.
	body := []byte(`{"alerts":[{"status":"firing","labels":{"alertname":"KubePodCrashLooping","severity":"critical"},"annotations":{"summary":"pod is crash looping"}}]}`)
	req := httptest.NewRequest(http.MethodPost, "/alertmanager/webhook?channel=incidents", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer secret-token")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want %d", w.Code, http.StatusOK)
	}

	var texts []string
	for i := 0; i < 2; i++ {
		select {
		case text := <-posted:
			texts = append(texts, text)
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out waiting for message %d of 2", i+1)
		}
	}
	if !strings.Contains(texts[1], "found the cause") {
		t.Errorf("expected the second posted message to contain the analysis, got: %v", texts)
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

func TestBuildFallbackNotification(t *testing.T) {
	alert := alertmanagerAlert{
		Labels:      map[string]string{"alertname": "KubePodCrashLooping", "severity": "critical"},
		Annotations: map[string]string{"summary": "pod is crash looping"},
		Fingerprint: "abc123",
	}
	text := buildFallbackNotification(alert)
	if !strings.Contains(text, "KubePodCrashLooping") {
		t.Errorf("expected alertname in fallback text, got: %s", text)
	}
	if !strings.Contains(text, "abc123") {
		t.Errorf("expected fingerprint in fallback text, got: %s", text)
	}
}

// mockPoster is a hand-written messagePoster for tests that need precise,
// per-call control over ConversationsHistory results (httptest can't easily
// script different responses for repeated calls to the same path).
type mockPoster struct {
	historyResponses [][]slackclient.Message
	historyCallCount int

	postCalls []postCall
	postTs    string
}

type postCall struct {
	channel  string
	threadTs string
	text     string
}

func (m *mockPoster) PostMessage(channel, threadTs, text string) (string, error) {
	m.postCalls = append(m.postCalls, postCall{channel, threadTs, text})
	return m.postTs, nil
}

func (m *mockPoster) ConversationsHistory(channel, oldest string) ([]slackclient.Message, error) {
	idx := m.historyCallCount
	m.historyCallCount++
	if idx < len(m.historyResponses) {
		return m.historyResponses[idx], nil
	}
	if len(m.historyResponses) > 0 {
		return m.historyResponses[len(m.historyResponses)-1], nil
	}
	return nil, nil
}

// newFakeClock returns a Now/advance pair for tests that exercise
// findNotificationTs's deadline logic: the returned sleep function must be
// wired into Handler.Sleep so backoff waits advance the same clock Now
// reads — otherwise the loop's attempt count diverges from what real
// time.Sleep would produce (a bug once caught in this exact task).
func newFakeClock(start time.Time) (now func() time.Time, sleep func(time.Duration)) {
	current := start
	now = func() time.Time { return current }
	sleep = func(d time.Duration) { current = current.Add(d) }
	return
}

func TestFindNotificationTs_FoundImmediately(t *testing.T) {
	mock := &mockPoster{
		historyResponses: [][]slackclient.Message{
			{{Text: "Critical alert fingerprint: `abc123`", Ts: "111.222"}},
		},
	}
	h := &Handler{Client: mock, Sleep: func(time.Duration) {}}

	ts := h.findNotificationTs("C1", "abc123")

	if ts != "111.222" {
		t.Errorf("got ts %q, want %q", ts, "111.222")
	}
	if mock.historyCallCount != 1 {
		t.Errorf("expected 1 history call, got %d", mock.historyCallCount)
	}
}

func TestFindNotificationTs_FoundInAttachmentText(t *testing.T) {
	// Regression test: Alertmanager's native slack_configs notification uses
	// the legacy Slack attachments format — its top-level Text is empty and
	// the real content lives in Attachments[0].Text. Verified against a real
	// notification captured live 2026-08-16; searching only m.Text (the
	// original implementation) never matched these messages at all.
	mock := &mockPoster{
		historyResponses: [][]slackclient.Message{
			{
				{
					Text: "",
					Ts:   "1786859390.110479",
					Attachments: []slackclient.Attachment{
						{Text: "*HolmesE2ETest4* (holmes-e2e-test-4)\nFresh group to bypass group_interval throttling\nfingerprint: `e3be599194200b94`"},
					},
				},
			},
		},
	}
	h := &Handler{Client: mock, Sleep: func(time.Duration) {}}

	ts := h.findNotificationTs("C1", "e3be599194200b94")

	if ts != "1786859390.110479" {
		t.Errorf("got ts %q, want %q", ts, "1786859390.110479")
	}
	if mock.historyCallCount != 1 {
		t.Errorf("expected 1 history call, got %d", mock.historyCallCount)
	}
}

func TestFindNotificationTs_FoundAfterRetry(t *testing.T) {
	var sleeps []time.Duration
	now, advance := newFakeClock(time.Now())
	mock := &mockPoster{
		historyResponses: [][]slackclient.Message{
			{},
			{},
			{{Text: "fingerprint: `abc123`", Ts: "333.444"}},
		},
	}
	h := &Handler{
		Client: mock,
		Now:    now,
		Sleep:  func(d time.Duration) { sleeps = append(sleeps, d); advance(d) },
	}

	ts := h.findNotificationTs("C1", "abc123")

	if ts != "333.444" {
		t.Errorf("got ts %q, want %q", ts, "333.444")
	}
	if mock.historyCallCount != 3 {
		t.Errorf("expected 3 history calls, got %d", mock.historyCallCount)
	}
	if len(sleeps) != 2 || sleeps[0] != time.Second || sleeps[1] != 2*time.Second {
		t.Errorf("expected exponential backoff [1s 2s], got %v", sleeps)
	}
}

func TestFindNotificationTs_NeverFound_GivesUp(t *testing.T) {
	var sleeps []time.Duration
	now, advance := newFakeClock(time.Now())
	mock := &mockPoster{historyResponses: [][]slackclient.Message{{}}}
	h := &Handler{
		Client: mock,
		Now:    now,
		Sleep:  func(d time.Duration) { sleeps = append(sleeps, d); advance(d) },
	}

	ts := h.findNotificationTs("C1", "never-matches")

	if ts != "" {
		t.Errorf("expected empty ts when nothing matches, got %q", ts)
	}
	if mock.historyCallCount != 6 {
		t.Errorf("expected 6 history calls (initial + 5 retries), got %d", mock.historyCallCount)
	}
	want := []time.Duration{time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 16 * time.Second}
	if len(sleeps) != len(want) {
		t.Fatalf("expected %d sleeps, got %d: %v", len(want), len(sleeps), sleeps)
	}
	for i, w := range want {
		if sleeps[i] != w {
			t.Errorf("sleep[%d] = %v, want %v", i, sleeps[i], w)
		}
	}
}

func TestFindNotificationTs_EmptyFingerprint_SkipsSearch(t *testing.T) {
	mock := &mockPoster{}
	h := &Handler{Client: mock}

	ts := h.findNotificationTs("C1", "")

	if ts != "" {
		t.Errorf("expected empty ts for empty fingerprint, got %q", ts)
	}
	if mock.historyCallCount != 0 {
		t.Errorf("expected no history calls for empty fingerprint, got %d", mock.historyCallCount)
	}
}

func TestInvestigateAlert_FoundNotification_ThreadsReply(t *testing.T) {
	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"analysis": "found the cause"})
	}))
	defer holmesServer.Close()

	mock := &mockPoster{
		historyResponses: [][]slackclient.Message{
			{{Text: "*KubePodCrashLooping* fingerprint: `abc123`", Ts: "999.111"}},
		},
		postTs: "should-not-be-used",
	}

	h := &Handler{
		HolmesGPT: holmesgptclient.New(holmesServer.URL, "test-model"),
		Client:    mock,
		Sleep:     func(time.Duration) {},
	}

	alert := alertmanagerAlert{
		Status:      "firing",
		Labels:      map[string]string{"alertname": "KubePodCrashLooping", "severity": "critical"},
		Annotations: map[string]string{"summary": "pod is crash looping"},
		Fingerprint: "abc123",
	}

	h.investigateAlert(alert, "C1")

	if len(mock.postCalls) != 1 {
		t.Fatalf("expected exactly 1 PostMessage call (no fallback needed), got %d: %+v", len(mock.postCalls), mock.postCalls)
	}
	final := mock.postCalls[0]
	if final.threadTs != "999.111" {
		t.Errorf("expected analysis threaded under found ts %q, got %q", "999.111", final.threadTs)
	}
	if !strings.Contains(final.text, "found the cause") {
		t.Errorf("expected analysis text, got %q", final.text)
	}
}

func TestInvestigateAlert_NotFound_PostsFallbackAndThreads(t *testing.T) {
	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"analysis": "found the cause"})
	}))
	defer holmesServer.Close()

	mock := &mockPoster{
		historyResponses: [][]slackclient.Message{{}},
		postTs:           "fallback-ts-555",
	}

	h := &Handler{
		HolmesGPT: holmesgptclient.New(holmesServer.URL, "test-model"),
		Client:    mock,
		Sleep:     func(time.Duration) {},
	}

	alert := alertmanagerAlert{
		Status:      "firing",
		Labels:      map[string]string{"alertname": "KubePodCrashLooping", "severity": "critical"},
		Annotations: map[string]string{"summary": "pod is crash looping"},
		Fingerprint: "never-matches",
	}

	h.investigateAlert(alert, "C1")

	if len(mock.postCalls) != 2 {
		t.Fatalf("expected 2 PostMessage calls (fallback notification + threaded analysis), got %d: %+v", len(mock.postCalls), mock.postCalls)
	}
	fallback := mock.postCalls[0]
	if fallback.threadTs != "" {
		t.Errorf("expected fallback notification to be a new top-level message, got threadTs=%q", fallback.threadTs)
	}
	if !strings.Contains(fallback.text, "never-matches") {
		t.Errorf("expected fallback notification to include the fingerprint, got %q", fallback.text)
	}
	final := mock.postCalls[1]
	if final.threadTs != "fallback-ts-555" {
		t.Errorf("expected analysis threaded under fallback ts %q, got %q", "fallback-ts-555", final.threadTs)
	}
	if !strings.Contains(final.text, "found the cause") {
		t.Errorf("expected analysis text, got %q", final.text)
	}
}
