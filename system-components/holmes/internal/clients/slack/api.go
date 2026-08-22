package slack

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	neturl "net/url"
	"time"
)

type Client struct {
	BotToken   string
	BaseURL    string
	HTTPClient *http.Client
}

func New(botToken string) *Client {
	return &Client{
		BotToken:   botToken,
		BaseURL:    "https://slack.com/api",
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) PostMessage(channel, threadTs, text string) (string, error) {
	payload := map[string]string{
		"channel": channel,
		"text":    text,
	}
	if threadTs != "" {
		payload["thread_ts"] = threadTs
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/chat.postMessage", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", "Bearer "+c.BotToken)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call slack api: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
		Ts    string `json:"ts"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return "", fmt.Errorf("slack api error: %s", result.Error)
	}
	return result.Ts, nil
}

func (c *Client) ConversationsReplies(channel, threadTs string) ([]Message, error) {
	url := fmt.Sprintf("%s/conversations.replies?channel=%s&ts=%s",
		c.BaseURL, neturl.QueryEscape(channel), neturl.QueryEscape(threadTs))
	return c.getMessages(url)
}

// ConversationsHistory fetches messages in channel no older than oldest (a
// Slack ts-format Unix timestamp string). Used to search for the
// Alertmanager-native notification a critical alert's investigation
// should thread under.
func (c *Client) ConversationsHistory(channel, oldest string) ([]Message, error) {
	url := fmt.Sprintf("%s/conversations.history?channel=%s&oldest=%s&limit=50",
		c.BaseURL, neturl.QueryEscape(channel), neturl.QueryEscape(oldest))
	return c.getMessages(url)
}

// GetPermalink returns a shareable URL for the message at ts in channel,
// via Slack's chat.getPermalink. Used to link a created GitHub issue back
// to the Slack thread it came from.
func (c *Client) GetPermalink(channel, ts string) (string, error) {
	url := fmt.Sprintf("%s/chat.getPermalink?channel=%s&message_ts=%s",
		c.BaseURL, neturl.QueryEscape(channel), neturl.QueryEscape(ts))

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.BotToken)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call slack api: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK        bool   `json:"ok"`
		Error     string `json:"error"`
		Permalink string `json:"permalink"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return "", fmt.Errorf("slack api error: %s", result.Error)
	}
	return result.Permalink, nil
}

func (c *Client) getMessages(url string) ([]Message, error) {
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
		OK       bool      `json:"ok"`
		Error    string    `json:"error"`
		Messages []Message `json:"messages"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return nil, fmt.Errorf("slack api error: %s", result.Error)
	}
	return result.Messages, nil
}
