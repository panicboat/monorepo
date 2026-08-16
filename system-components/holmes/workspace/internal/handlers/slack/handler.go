package slack

import (
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
	Chat(ask string) (string, error)
}

type issueCreator interface {
	CreateIssue(repo, title, body string) (string, error)
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

type issueAction struct {
	Action string `json:"action"`
	Repo   string `json:"repo"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	Ready  bool   `json:"ready"`
	Reason string `json:"reason"`
}

type Handler struct {
	Cfg    config.Config
	Holmes investigator
	Client messagePoster
	GitHub issueCreator
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

	response, err := h.Holmes.Chat(ask)
	if err != nil {
		if _, postErr := h.Client.PostMessage(evt.Channel, threadTs, fmt.Sprintf("investigation failed: %v", err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	var action issueAction
	if err := json.Unmarshal([]byte(stripCodeFence(response)), &action); err == nil && action.Action == "create_issue" {
		h.handleIssueAction(evt.Channel, threadTs, action)
		return
	}

	if _, err := h.Client.PostMessage(evt.Channel, threadTs, response); err != nil {
		log.Printf("failed to post analysis: %v", err)
	}
}

// handleIssueAction either asks the user to confirm an inferred repo, or
// creates the issue and reports the result — never both.
func (h *Handler) handleIssueAction(channel, threadTs string, action issueAction) {
	if !action.Ready {
		msg := fmt.Sprintf("推定した repo は `%s` です（理由: %s）。作成してよければ「はい」と返信してください。", action.Repo, action.Reason)
		if _, err := h.Client.PostMessage(channel, threadTs, msg); err != nil {
			log.Printf("failed to post confirmation request: %v", err)
		}
		return
	}

	url, err := h.GitHub.CreateIssue(action.Repo, action.Title, action.Body)
	if err != nil {
		if _, postErr := h.Client.PostMessage(channel, threadTs, fmt.Sprintf("issue creation failed: %v", err)); postErr != nil {
			log.Printf("failed to post issue creation error: %v", postErr)
		}
		return
	}

	if _, err := h.Client.PostMessage(channel, threadTs, fmt.Sprintf("Issue を作成しました: %s", url)); err != nil {
		log.Printf("failed to post issue creation result: %v", err)
	}
}

// stripCodeFence removes a surrounding markdown code fence (```json ... ```
// or ``` ... ```), if present. issueIntentInstructions tells HolmesGPT not
// to wrap its JSON envelope in one, but LLMs commonly do anyway — this
// keeps that response parseable instead of silently falling back to
// posting the raw fenced text as if it were a normal analysis.
func stripCodeFence(s string) string {
	trimmed := strings.TrimSpace(s)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	return strings.TrimSpace(trimmed)
}
