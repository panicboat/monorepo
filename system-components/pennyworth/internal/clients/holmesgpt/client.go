package holmesgpt

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

//go:embed prompts/formatting.md
var formattingPrompt string

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
		return "", fmt.Errorf("call HolmesGPT api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HolmesGPT api returned status %d", resp.StatusCode)
	}

	var chatResp holmesChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	return chatResp.Analysis, nil
}
