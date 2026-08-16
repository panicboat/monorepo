package slack

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	slackclient "github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
)

type investigator interface {
	Investigate(ask string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
}

type slackEventPayload struct {
	Type      string           `json:"type"`
	Challenge string           `json:"challenge,omitempty"`
	Event     *slackInnerEvent `json:"event,omitempty"`
}

type slackInnerEvent struct {
	Type     string `json:"type"`
	Channel  string `json:"channel"`
	User     string `json:"user"`
	Text     string `json:"text"`
	Ts       string `json:"ts"`
	ThreadTs string `json:"thread_ts,omitempty"`
}

type Handler struct {
	Cfg    config.Config
	Holmes investigator
	Client messagePoster
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "cannot read body", http.StatusBadRequest)
		return
	}

	if err := slackclient.VerifySignature(h.Cfg.SlackSigningSecret, r.Header, body, time.Now()); err != nil {
		log.Printf("slack signature verification failed: %v", err)
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	var payload slackEventPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	if payload.Type == "url_verification" {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(payload.Challenge))
		return
	}

	if payload.Type == "event_callback" && payload.Event != nil && payload.Event.Type == "app_mention" {
		w.WriteHeader(http.StatusOK)
		go h.handleMention(*payload.Event)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) handleMention(evt slackInnerEvent) {
	threadTs := evt.ThreadTs
	if threadTs == "" {
		threadTs = evt.Ts
	}

	ask := slackclient.StripMention(evt.Text)

	if evt.ThreadTs != "" {
		history, err := h.Client.ConversationsReplies(evt.Channel, evt.ThreadTs)
		if err != nil {
			log.Printf("failed to fetch thread history: %v", err)
		} else if len(history) > 0 {
			ask = slackclient.BuildAskWithHistory(history, ask)
		}
	}

	if _, err := h.Client.PostMessage(evt.Channel, threadTs, "🔍 investigating..."); err != nil {
		log.Printf("failed to post ack message: %v", err)
	}

	analysis, err := h.Holmes.Investigate(ask)
	if err != nil {
		if _, postErr := h.Client.PostMessage(evt.Channel, threadTs, fmt.Sprintf("investigation failed: %v", err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if _, err := h.Client.PostMessage(evt.Channel, threadTs, analysis); err != nil {
		log.Printf("failed to post analysis: %v", err)
	}
}
