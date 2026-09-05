package config

import (
	"fmt"
	"os"
)

type Config struct {
	SlackSigningSecret      string
	SlackBotToken           string
	AlertmanagerToken       string
	HolmesAPIURL            string
	HolmesModel             string
	GitHubAppID             string
	GitHubAppPrivateKey     string
	GitHubAppInstallationID string
}

func fromEnv() Config {
	cfg := Config{
		SlackSigningSecret:      os.Getenv("SLACK_SIGNING_SECRET"),
		SlackBotToken:           os.Getenv("SLACK_BOT_TOKEN"),
		AlertmanagerToken:       os.Getenv("ALERTMANAGER_SHARED_TOKEN"),
		HolmesAPIURL:            os.Getenv("HOLMES_API_URL"),
		HolmesModel:             os.Getenv("HOLMES_MODEL"),
		GitHubAppID:             os.Getenv("GITHUB_APP_ID"),
		GitHubAppPrivateKey:     os.Getenv("GITHUB_APP_PRIVATE_KEY"),
		GitHubAppInstallationID: os.Getenv("GITHUB_APP_INSTALLATION_ID"),
	}
	if cfg.HolmesModel == "" {
		cfg.HolmesModel = "sonnet-4-6"
	}
	return cfg
}

// LoadSlack loads and validates the environment variables the Slack
// mention process needs: verifying/posting to Slack and creating GitHub
// issues.
func LoadSlack() (Config, error) {
	cfg := fromEnv()
	if cfg.SlackSigningSecret == "" {
		return cfg, fmt.Errorf("SLACK_SIGNING_SECRET is required")
	}
	if cfg.SlackBotToken == "" {
		return cfg, fmt.Errorf("SLACK_BOT_TOKEN is required")
	}
	if cfg.HolmesAPIURL == "" {
		return cfg, fmt.Errorf("HOLMES_API_URL is required")
	}
	if cfg.GitHubAppID == "" {
		return cfg, fmt.Errorf("GITHUB_APP_ID is required")
	}
	if cfg.GitHubAppPrivateKey == "" {
		return cfg, fmt.Errorf("GITHUB_APP_PRIVATE_KEY is required")
	}
	if cfg.GitHubAppInstallationID == "" {
		return cfg, fmt.Errorf("GITHUB_APP_INSTALLATION_ID is required")
	}
	return cfg, nil
}

// LoadAlertmanager loads and validates the environment variables the
// Alertmanager relay process needs: verifying the webhook and posting
// to Slack. It never requires GitHub App credentials.
func LoadAlertmanager() (Config, error) {
	cfg := fromEnv()
	if cfg.AlertmanagerToken == "" {
		return cfg, fmt.Errorf("ALERTMANAGER_SHARED_TOKEN is required")
	}
	if cfg.SlackBotToken == "" {
		return cfg, fmt.Errorf("SLACK_BOT_TOKEN is required")
	}
	if cfg.HolmesAPIURL == "" {
		return cfg, fmt.Errorf("HOLMES_API_URL is required")
	}
	return cfg, nil
}
