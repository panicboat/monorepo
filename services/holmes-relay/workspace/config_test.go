package main

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

func TestLoadConfig_AllRequiredPresent(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "sig-secret")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "HOLMES_API_URL", "http://holmesgpt-holmes.holmesgpt.svc.cluster.local")
	os.Unsetenv("HOLMES_MODEL")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HolmesModel != "sonnet-4-6" {
		t.Errorf("expected default model sonnet-4-6, got %q", cfg.HolmesModel)
	}
}

func TestLoadConfig_MissingRequired(t *testing.T) {
	setEnv(t, "SLACK_SIGNING_SECRET", "")
	setEnv(t, "SLACK_BOT_TOKEN", "xoxb-test")
	setEnv(t, "ALERTMANAGER_SHARED_TOKEN", "am-token")
	setEnv(t, "HOLMES_API_URL", "http://example.invalid")

	if _, err := loadConfig(); err == nil {
		t.Fatal("expected error when SLACK_SIGNING_SECRET is missing, got nil")
	}
}
