package holmes

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// slackFormattingInstructions is sent as HolmesGPT's additional_system_prompt
// on every request. HolmesGPT's default output is standard Markdown and
// English; holmes relays the response into Slack chat.postMessage verbatim
// with no reformatting, so it must ask HolmesGPT to produce Slack's mrkdwn
// dialect directly (Slack does not render **bold**, #-headings, or
// [text](url) links — see the mismatches this fixes) and to respond in
// Japanese, the team's operating language.
const slackFormattingInstructions = `Respond in Japanese.

Format your response using Slack's mrkdwn syntax, not standard Markdown:
- Bold: *text* (single asterisks, not **text**)
- No markdown headings (#, ##, ###) — use *bold* text as a section label instead
- Links: <https://example.com|link text>, not [link text](https://example.com)
- Bullet lists: start each line with "• " (not "- " or "* ")`

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
	reqBody, err := json.Marshal(holmesChatRequest{
		Ask:                    ask,
		Model:                  c.Model,
		AdditionalSystemPrompt: slackFormattingInstructions,
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
