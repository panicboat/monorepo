package github

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type Client struct {
	AppID          string
	PrivateKey     *rsa.PrivateKey
	InstallationID string
	BaseURL        string
	HTTPClient     *http.Client

	mu          sync.Mutex
	cachedToken string
	tokenExpiry time.Time
}

func New(appID, privateKeyPEM, installationID string) (*Client, error) {
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil {
		return nil, fmt.Errorf("decode private key: no PEM block found")
	}
	key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse private key: %w", err)
	}
	return &Client{
		AppID:          appID,
		PrivateKey:     key,
		InstallationID: installationID,
		BaseURL:        "https://api.github.com",
		HTTPClient:     &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func base64URLEncode(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}

// GitHub rejects App JWTs that exceed its ten-minute lifetime; backdating
// avoids a false rejection when the local and GitHub clocks differ slightly.
func (c *Client) generateJWT() (string, error) {
	now := time.Now()
	header := base64URLEncode([]byte(`{"alg":"RS256","typ":"JWT"}`))
	claims := base64URLEncode([]byte(fmt.Sprintf(
		`{"iat":%d,"exp":%d,"iss":"%s"}`,
		now.Add(-60*time.Second).Unix(),
		now.Add(9*time.Minute).Unix(),
		c.AppID,
	)))
	signingInput := header + "." + claims
	hash := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, c.PrivateKey, crypto.SHA256, hash[:])
	if err != nil {
		return "", fmt.Errorf("sign jwt: %w", err)
	}
	return signingInput + "." + base64URLEncode(sig), nil
}

type installationTokenResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (c *Client) installationToken() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.cachedToken != "" && time.Now().Before(c.tokenExpiry.Add(-1*time.Minute)) {
		return c.cachedToken, nil
	}

	jwt, err := c.generateJWT()
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/app/installations/%s/access_tokens", c.BaseURL, c.InstallationID)
	req, err := http.NewRequest(http.MethodPost, url, nil)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call github api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("github api returned status %d requesting installation token", resp.StatusCode)
	}

	var result installationTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	c.cachedToken = result.Token
	c.tokenExpiry = result.ExpiresAt
	return c.cachedToken, nil
}

type createIssueRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

type createIssueResponse struct {
	HTMLURL string `json:"html_url"`
}

func (c *Client) CreateIssue(repo, title, body string) (string, error) {
	token, err := c.installationToken()
	if err != nil {
		return "", fmt.Errorf("get installation token: %w", err)
	}

	reqBody, err := json.Marshal(createIssueRequest{Title: title, Body: body})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/repos/%s/issues", c.BaseURL, repo)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call github api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("github api returned status %d creating issue in %s", resp.StatusCode, repo)
	}

	var result createIssueResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	return result.HTMLURL, nil
}
