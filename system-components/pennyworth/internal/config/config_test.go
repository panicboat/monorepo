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

func unsetEnv(t *testing.T, key string) {
	t.Helper()
	old, hadOld := os.LookupEnv(key)
	os.Unsetenv(key)
	t.Cleanup(func() {
		if hadOld {
			os.Setenv(key, old)
		}
	})
}

func TestLoadSlack_AllRequiredPresent(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	setEnv(t, "GITHUB_APP_ID", "123")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")
	unsetEnv(t, "HOLMESGPT_MODEL")
	unsetEnv(t, "ALERTMANAGER_SHARED_TOKEN")

	cfg, err := LoadSlack()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HolmesGPTModel != "sonnet-4-6" {
		t.Errorf("expected default model sonnet-4-6, got %q", cfg.HolmesGPTModel)
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

func TestLoadSlack_MissingSigningSecret(t *testing.T) {
	unsetEnv(t, "SLACK_SIGNING_SECRET")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://example.invalid")
	setEnv(t, "GITHUB_APP_ID", "123")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")

	if _, err := LoadSlack(); err == nil {
		t.Fatal("expected error when SLACK_SIGNING_SECRET is missing, got nil")
	}
}

func TestLoadSlack_MissingGitHubAppID(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://example.invalid")
	unsetEnv(t, "GITHUB_APP_ID")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")

	if _, err := LoadSlack(); err == nil {
		t.Fatal("expected error when GITHUB_APP_ID is missing, got nil")
	}
}

func TestLoadSlack_DoesNotRequireAlertmanagerToken(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://example.invalid")
	setEnv(t, "GITHUB_APP_ID", "123")
	setEnv(t, "GITHUB_APP_PRIVATE_KEY", "test-key")
	setEnv(t, "GITHUB_APP_INSTALLATION_ID", "456")
	unsetEnv(t, "ALERTMANAGER_SHARED_TOKEN")

	if _, err := LoadSlack(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadAlertmanager_AllRequiredPresent(t *testing.T) {
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	unsetEnv(t, "HOLMESGPT_MODEL")
	unsetEnv(t, "SLACK_SIGNING_SECRET")
	unsetEnv(t, "GITHUB_APP_ID")

	cfg, err := LoadAlertmanager()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HolmesGPTModel != "sonnet-4-6" {
		t.Errorf("expected default model sonnet-4-6, got %q", cfg.HolmesGPTModel)
	}
	if cfg.AlertmanagerToken != "am-token" {
		t.Errorf("expected AlertmanagerToken %q, got %q", "am-token", cfg.AlertmanagerToken)
	}
}

func TestLoadAlertmanager_MissingToken(t *testing.T) {
	unsetEnv(t, "ALERTMANAGER_SHARED_TOKEN")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://example.invalid")

	if _, err := LoadAlertmanager(); err == nil {
		t.Fatal("expected error when ALERTMANAGER_SHARED_TOKEN is missing, got nil")
	}
}

func TestLoadAlertmanager_DoesNotRequireGitHubApp(t *testing.T) {
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "HOLMESGPT_API_URL", "http://example.invalid")
	unsetEnv(t, "GITHUB_APP_ID")
	unsetEnv(t, "GITHUB_APP_PRIVATE_KEY")
	unsetEnv(t, "GITHUB_APP_INSTALLATION_ID")
	unsetEnv(t, "SLACK_SIGNING_SECRET")

	if _, err := LoadAlertmanager(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
