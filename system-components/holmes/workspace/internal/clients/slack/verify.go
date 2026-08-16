package slack

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func VerifySignature(signingSecret string, header http.Header, body []byte, now time.Time) error {
	tsStr := header.Get("X-Slack-Request-Timestamp")
	sig := header.Get("X-Slack-Signature")
	if tsStr == "" || sig == "" {
		return fmt.Errorf("missing signature headers")
	}

	ts, err := strconv.ParseInt(tsStr, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid timestamp: %w", err)
	}
	if now.Sub(time.Unix(ts, 0)).Abs() > 5*time.Minute {
		return fmt.Errorf("timestamp too old")
	}

	baseString := "v0:" + tsStr + ":" + string(body)
	mac := hmac.New(sha256.New, []byte(signingSecret))
	mac.Write([]byte(baseString))
	expected := "v0=" + hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(sig)) {
		return fmt.Errorf("signature mismatch")
	}
	return nil
}

var mentionPrefix = regexp.MustCompile(`^\s*(<@[A-Z0-9]+>\s*)+`)

func StripMention(text string) string {
	return strings.TrimSpace(mentionPrefix.ReplaceAllString(text, ""))
}

type Message struct {
	Text        string       `json:"text"`
	User        string       `json:"user"`
	Ts          string       `json:"ts"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

// Attachment is Slack's legacy attachments format. Alertmanager's
// slack_configs posts notifications this way — the message's top-level
// Text is empty and the actual content (including anything a search needs
// to match against) lives here instead.
type Attachment struct {
	Text string `json:"text"`
}

func BuildAskWithHistory(history []Message, ask string) string {
	var b strings.Builder
	b.WriteString("Slack thread context:\n")
	for _, m := range history {
		b.WriteString(fmt.Sprintf("- %s\n", m.Text))
	}
	b.WriteString("\nInvestigation request: ")
	b.WriteString(ask)
	return b.String()
}
