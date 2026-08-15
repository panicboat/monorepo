package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type HolmesClient struct {
	BaseURL    string
	Model      string
	HTTPClient *http.Client
}

func NewHolmesClient(baseURL, model string) *HolmesClient {
	return &HolmesClient{
		BaseURL: baseURL,
		Model:   model,
		HTTPClient: &http.Client{
			Timeout: 90 * time.Second,
		},
	}
}

type holmesChatRequest struct {
	Ask   string `json:"ask"`
	Model string `json:"model"`
}

type holmesChatResponse struct {
	Analysis string `json:"analysis"`
}

func (c *HolmesClient) Investigate(ask string) (string, error) {
	reqBody, err := json.Marshal(holmesChatRequest{Ask: ask, Model: c.Model})
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
