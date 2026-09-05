package holmesgpt

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// formattingPrompt is sent as HolmesGPT's additional_system_prompt on
// every request. HolmesGPT's default output is standard Markdown and
// English; holmes relays the response into Slack chat.postMessage
// verbatim with no reformatting, so it must ask HolmesGPT to produce
// Slack's mrkdwn dialect directly (Slack does not render **bold**,
// #-headings, or [text](url) links) and to respond in Japanese, the
// team's operating language. It also names the two source repositories
// HolmesGPT can read via its bash toolset's git allowlist (see
// panicboat/platform's kubernetes/components/holmesgpt component) —
// HolmesGPT has no other way to learn these repos exist or when to use
// them.
//
//go:embed prompts/formatting.md
var formattingPrompt string

// createIssuePrompt is appended to Chat's additional_system_prompt only
// (never Investigate's — Alertmanager's fixed alert-investigation ask
// never carries human issue-creation intent, so keeping this off that
// path means it can never receive or need to parse a create_issue
// envelope).
//
//go:embed prompts/create_issue.md
var createIssuePrompt string

type Client struct {
	BaseURL    string
	Model      string
	HTTPClient *http.Client
}

func New(baseURL, model string) *Client {
	return &Client{
		BaseURL: baseURL,
		Model:   model,
		HTTPClient: &http.Client{
			Timeout: 90 * time.Second,
		},
	}
}

type holmesChatRequest struct {
	Ask                    string `json:"ask"`
	Model                  string `json:"model"`
	AdditionalSystemPrompt string `json:"additional_system_prompt"`
}

type holmesChatResponse struct {
	Analysis string `json:"analysis"`
}

func (c *Client) Investigate(ask string) (string, error) {
	return c.chat(ask, formattingPrompt)
}

// Chat is used by the Slack mention flow — same request/response shape as
// Investigate, but its additional_system_prompt also asks HolmesGPT to
// detect action intent (see createIssuePrompt).
func (c *Client) Chat(ask string) (string, error) {
	return c.chat(ask, formattingPrompt+"\n\n"+createIssuePrompt)
}

func (c *Client) chat(ask, additionalSystemPrompt string) (string, error) {
	reqBody, err := json.Marshal(holmesChatRequest{
		Ask:                    ask,
		Model:                  c.Model,
		AdditionalSystemPrompt: additionalSystemPrompt,
	})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/chat", bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call holmes api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("holmes api returned status %d", resp.StatusCode)
	}

	var chatResp holmesChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	return chatResp.Analysis, nil
}
