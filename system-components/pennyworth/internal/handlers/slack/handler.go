package slack

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	slackclient "github.com/panicboat/monorepo/system-components/pennyworth/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/pennyworth/internal/config"
)

type investigator interface {
	Chat(ask string) (string, error)
}

type issueCreator interface {
	CreateIssue(repo, title, body string, labels []string) (string, error)
}

type messagePoster interface {
	PostMessage(channel, threadTs, text string) (string, error)
	ConversationsReplies(channel, threadTs string) ([]slackclient.Message, error)
	GetPermalink(channel, ts string) (string, error)
	AddReaction(channel, ts, name string) error
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

// actionEnvelope is the common wrapper HolmesGPT returns when it decides
// a message requests an action, instead of a plain analysis. Action is
// empty when the response is a plain analysis — callers check that
// before treating the rest of the envelope as meaningful. Payload stays
// raw until the action name is known, so each action's fields live in
// their own struct instead of piling into one shared one.
type actionEnvelope struct {
	Action  string          `json:"action"`
	Ready   bool            `json:"ready"`
	Reason  string          `json:"reason"`
	Payload json.RawMessage `json:"payload"`
}

type createIssuePayload struct {
	Repo     string `json:"repo"`
	Title    string `json:"title"`
	Body     string `json:"body"`
	Severity string `json:"severity"`
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

	if err := h.Client.AddReaction(evt.Channel, evt.Ts, "eyes"); err != nil {
		log.Printf("failed to add eyes reaction: %v", err)
	}

	response, err := h.Holmes.Chat(ask)
	if err != nil {
		if reactErr := h.Client.AddReaction(evt.Channel, evt.Ts, "face_vomiting"); reactErr != nil {
			log.Printf("failed to add face_vomiting reaction: %v", reactErr)
		}
		if _, postErr := h.Client.PostMessage(evt.Channel, threadTs, fmt.Sprintf("investigation failed: %v", err)); postErr != nil {
			log.Printf("failed to post error message: %v", postErr)
		}
		return
	}

	if err := h.Client.AddReaction(evt.Channel, evt.Ts, "white_check_mark"); err != nil {
		log.Printf("failed to add white_check_mark reaction: %v", err)
	}

	env, ok := parseActionEnvelope(response)
	if !ok {
		if _, err := h.Client.PostMessage(evt.Channel, threadTs, response); err != nil {
			log.Printf("failed to post analysis: %v", err)
		}
		return
	}

	h.dispatchAction(evt.Channel, threadTs, env)
}

// parseActionEnvelope reports ok=false when response carries no action
// field — meaning HolmesGPT judged no action was requested, so response
// is a plain analysis to post as-is rather than an envelope to dispatch.
func parseActionEnvelope(response string) (env actionEnvelope, ok bool) {
	if err := json.Unmarshal([]byte(stripCodeFence(response)), &env); err != nil {
		return actionEnvelope{}, false
	}
	if env.Action == "" {
		return actionEnvelope{}, false
	}
	return env, true
}

func (h *Handler) dispatchAction(channel, threadTs string, env actionEnvelope) {
	switch env.Action {
	case "create_issue":
		h.handleCreateIssue(channel, threadTs, env)
	default:
		log.Printf("unknown action %q from holmes response", env.Action)
		if _, err := h.Client.PostMessage(channel, threadTs, "アクションの解析に失敗しました（不明な action です）"); err != nil {
			log.Printf("failed to post unknown-action message: %v", err)
		}
	}
}

// handleCreateIssue either asks the user to confirm an inferred repo, or
// creates the issue and reports the result — never both.
func (h *Handler) handleCreateIssue(channel, threadTs string, env actionEnvelope) {
	var payload createIssuePayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		log.Printf("failed to decode create_issue payload: %v", err)
		if _, postErr := h.Client.PostMessage(channel, threadTs, "アクションの解析に失敗しました（create_issue の内容が不正です）"); postErr != nil {
			log.Printf("failed to post payload-decode-failure message: %v", postErr)
		}
		return
	}

	if !env.Ready {
		msg := fmt.Sprintf("推定した repo は `%s` です（理由: %s）。作成してよければ「はい」と返信してください。", payload.Repo, env.Reason)
		if _, err := h.Client.PostMessage(channel, threadTs, msg); err != nil {
			log.Printf("failed to post confirmation request: %v", err)
		}
		return
	}

	body := payload.Body
	if permalink, err := h.Client.GetPermalink(channel, threadTs); err != nil {
		// FALLBACK: issue creation must not depend on the optional thread link.
		log.Printf("failed to get thread permalink: %v", err)
	} else {
		body = fmt.Sprintf("%s\n\n---\n**元スレッド:** %s", body, permalink)
	}

	var labels []string
	if payload.Severity != "" {
		labels = []string{payload.Severity}
	}

	url, err := h.GitHub.CreateIssue(payload.Repo, payload.Title, body, labels)
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
// or ``` ... ```), if present. The create_issue prompt instructs HolmesGPT
// not to wrap its JSON envelope in one, but LLMs commonly do anyway — this
// keeps that response parseable instead of failing to detect the action.
func stripCodeFence(s string) string {
	trimmed := strings.TrimSpace(s)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	return strings.TrimSpace(trimmed)
}
