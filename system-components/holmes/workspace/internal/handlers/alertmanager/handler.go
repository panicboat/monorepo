package alertmanager

import (
	"crypto/hmac"
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
	Investigate(ask string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsHistory(channel, oldest string) ([]slackclient.Message, error)
}

type alertmanagerWebhook struct {
	Status string              `json:"status"`
	Alerts []alertmanagerAlert `json:"alerts"`
}

type alertmanagerAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Fingerprint string            `json:"fingerprint"`
}

const (
	searchInitialInterval = 1 * time.Second
	searchMaxTotal        = 60 * time.Second
	searchBackoffFactor   = 2
)

type Handler struct {
	Cfg    config.Config
	Holmes investigator
	Client messagePoster
	// Sleep defaults to time.Sleep. Tests inject a call-recording no-op so
	// the retry loop's attempt count and deadline handling run without
	// real waiting.
	Sleep func(time.Duration)
	Now   func() time.Time
}

func (h *Handler) sleep(d time.Duration) {
	if h.Sleep != nil {
		h.Sleep(d)
		return
	}
	time.Sleep(d)
}

func (h *Handler) now() time.Time {
	if h.Now != nil {
		return h.Now()
	}
	return time.Now()
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	if !hmac.Equal([]byte(auth), []byte("Bearer "+h.Cfg.AlertmanagerToken)) {
		log.Printf("alertmanager auth token rejected")
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	channel := r.URL.Query().Get("channel")
	if channel == "" {
		http.Error(w, "missing channel query parameter", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "cannot read body", http.StatusBadRequest)
		return
	}

	var payload alertmanagerWebhook
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)

	for _, alert := range payload.Alerts {
		if alert.Status != "firing" {
			continue
		}
		go h.investigateAlert(alert, channel)
	}
}

func (h *Handler) investigateAlert(alert alertmanagerAlert, channel string) {
	ts := h.findNotificationTs(channel, alert.Fingerprint)
	if ts == "" {
		fallbackTs, err := h.Client.PostMessage(channel, "", buildFallbackNotification(alert))
		if err != nil {
			log.Printf("failed to post fallback notification: %v", err)
		}
		ts = fallbackTs
	}

	ask := buildAlertAsk(alert)

	analysis, err := h.Holmes.Investigate(ask)
	if err != nil {
		if _, postErr := h.Client.PostMessage(channel, ts, fmt.Sprintf("investigation failed for alert %s: %v", alert.Labels["alertname"], err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if _, err := h.Client.PostMessage(channel, ts, fmt.Sprintf("*Alert: %s*\n%s", alert.Labels["alertname"], analysis)); err != nil {
		log.Printf("failed to post analysis: %v", err)
	}
}

// findNotificationTs searches recent channel history for the
// Alertmanager-native notification matching this alert's fingerprint,
// retrying with exponential backoff since Alertmanager's slack_configs and
// webhook_configs for the same receiver fire concurrently with no ordering
// guarantee. Returns "" if nothing matches within the search budget, or
// immediately if fingerprint is empty (nothing to match against).
func (h *Handler) findNotificationTs(channel, fingerprint string) string {
	if fingerprint == "" {
		return ""
	}

	oldest := fmt.Sprintf("%d", h.now().Add(-2*time.Minute).Unix())
	deadline := h.now().Add(searchMaxTotal)
	interval := searchInitialInterval

	for {
		if ts := h.searchByFingerprint(channel, oldest, fingerprint); ts != "" {
			return ts
		}
		if h.now().Add(interval).After(deadline) {
			return ""
		}
		h.sleep(interval)
		interval *= searchBackoffFactor
	}
}

func (h *Handler) searchByFingerprint(channel, oldest, fingerprint string) string {
	messages, err := h.Client.ConversationsHistory(channel, oldest)
	if err != nil {
		log.Printf("failed to search conversation history: %v", err)
		return ""
	}
	for _, m := range messages {
		if strings.Contains(m.Text, fingerprint) {
			return m.Ts
		}
	}
	return ""
}

func buildFallbackNotification(alert alertmanagerAlert) string {
	return fmt.Sprintf("*%s* (%s)\n%s\nfingerprint: `%s`",
		alert.Labels["alertname"], alert.Labels["severity"], alert.Annotations["summary"], alert.Fingerprint)
}

func buildAlertAsk(alert alertmanagerAlert) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Investigate the following firing alert: %s\n", alert.Labels["alertname"]))
	b.WriteString("Labels:\n")
	for k, v := range alert.Labels {
		b.WriteString(fmt.Sprintf("- %s: %s\n", k, v))
	}
	b.WriteString("Annotations:\n")
	for k, v := range alert.Annotations {
		b.WriteString(fmt.Sprintf("- %s: %s\n", k, v))
	}
	return b.String()
}
