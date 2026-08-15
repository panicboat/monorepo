package main

import (
	"crypto/hmac"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

type alertmanagerWebhook struct {
	Status string              `json:"status"`
	Alerts []alertmanagerAlert `json:"alerts"`
}

type alertmanagerAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type alertmanagerHandler struct {
	cfg    Config
	holmes *HolmesClient
	client *slackAPIClient
}

func (h *alertmanagerHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	if !hmac.Equal([]byte(auth), []byte("Bearer "+h.cfg.AlertmanagerToken)) {
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

func (h *alertmanagerHandler) investigateAlert(alert alertmanagerAlert, channel string) {
	ask := buildAlertAsk(alert)

	analysis, err := h.holmes.Investigate(ask)
	if err != nil {
		if postErr := h.client.PostMessage(channel, "", fmt.Sprintf("investigation failed for alert %s: %v", alert.Labels["alertname"], err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if err := h.client.PostMessage(channel, "", fmt.Sprintf("*Alert: %s*\n%s", alert.Labels["alertname"], analysis)); err != nil {
		log.Printf("failed to post analysis: %v", err)
	}
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
