package config

import (
	"os"
	"testing"
)

func setEnv(t *testing.T, key, value string) {
	t.Helper()
	old, hadOld := os.LookupEnv(key)
	os.Setenv(key, value)
	t.Cleanup(func() {
		if hadOld {
			os.Setenv(key, old)
		} else {
			os.Unsetenv(key)
		}
	})
}

func TestLoad_AllRequiredPresent(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "HOLMES_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	setEnv(t, "GITHUB_APP_ID", "123")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")
	os.Unsetenv("HOLMES_MODEL")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HolmesModel != "sonnet-4-6" {
		t.Errorf("expected default model sonnet-4-6, got %q", cfg.HolmesModel)
	}
	if cfg.GitHubAppID != "123" {
		t.Errorf("expected GitHubAppID %q, got %q", "123", cfg.GitHubAppID)
	}
	if cfg.GitHubAppPrivateKey != "test-key" {
		t.Errorf("expected GitHubAppPrivateKey %q, got %q", "test-key", cfg.GitHubAppPrivateKey)
	}
	if cfg.GitHubAppInstallationID != "456" {
		t.Errorf("expected GitHubAppInstallationID %q, got %q", "456", cfg.GitHubAppInstallationID)
	}
}

func TestLoad_MissingRequired(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "HOLMES_API_URL", "http://example.invalid")

	if _, err := Load(); err == nil {
		t.Fatal("expected error when SLACK_SIGNING_SECRET is missing, got nil")
	}
}
