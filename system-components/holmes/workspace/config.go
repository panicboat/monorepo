package main

import (
	"fmt"
	"os"
)

type Config struct {
	SlackSigningSecret string
	SlackBotToken      string
	AlertmanagerToken  string
	HolmesAPIURL       string
	HolmesModel        string
}

func loadConfig() (Config, error) {
	cfg := Config{
		SlackSigningSecret: os.Getenv("SLACK_SIGNING_SECRET"),
		SlackBotToken:      os.Getenv("SLACK_BOT_TOKEN"),
		AlertmanagerToken:  os.Getenv("ALERTMANAGER_SHARED_TOKEN"),
		HolmesAPIURL:       os.Getenv("HOLMES_API_URL"),
		HolmesModel:        os.Getenv("HOLMES_MODEL"),
	}
	if cfg.SlackSigningSecret == "" {
		return cfg, fmt.Errorf("SLACK_SIGNING_SECRET is required")
	}
	if cfg.SlackBotToken == "" {
		return cfg, fmt.Errorf("SLACK_BOT_TOKEN is required")
	}
	if cfg.AlertmanagerToken == "" {
		return cfg, fmt.Errorf("ALERTMANAGER_SHARED_TOKEN is required")
	}
	if cfg.HolmesAPIURL == "" {
		return cfg, fmt.Errorf("HOLMES_API_URL is required")
	}
	if cfg.HolmesModel == "" {
		cfg.HolmesModel = "sonnet-4-6"
	}
	return cfg, nil
}
