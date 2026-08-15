package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	neturl "net/url"
	"time"
)

type slackAPIClient struct {
	BotToken   string
	BaseURL    string
	HTTPClient *http.Client
}

func newSlackAPIClient(botToken string) *slackAPIClient {
	return &slackAPIClient{
		BotToken:   botToken,
		BaseURL:    "https://slack.com/api",
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *slackAPIClient) PostMessage(channel, threadTs, text string) error {
	payload := map[string]string{
		"channel": channel,
		"text":    text,
	}
	if threadTs != "" {
		payload["thread_ts"] = threadTs
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/chat.postMessage", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", "Bearer "+c.BotToken)

	return c.doSlackRequest(req)
}

func (c *slackAPIClient) ConversationsReplies(channel, threadTs string) ([]slackMessage, error) {
	url := fmt.Sprintf("%s/conversations.replies?channel=%s&ts=%s",
		c.BaseURL, neturl.QueryEscape(channel), neturl.QueryEscape(threadTs))
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.BotToken)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call slack api: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK       bool           `json:"ok"`
		Error    string         `json:"error"`
		Messages []slackMessage `json:"messages"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return nil, fmt.Errorf("slack api error: %s", result.Error)
	}
	return result.Messages, nil
}

func (c *slackAPIClient) doSlackRequest(req *http.Request) error {
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("call slack api: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return fmt.Errorf("slack api error: %s", result.Error)
	}
	return nil
}
