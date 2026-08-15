package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"
)

func sign(secret, tsStr string, body []byte) string {
	baseString := "v0:" + tsStr + ":" + string(body)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(baseString))
	return "v0=" + hex.EncodeToString(mac.Sum(nil))
}

func TestVerifySlackSignature_Valid(t *testing.T) {
	secret := "test-signing-secret"
	body := []byte(`{"type":"url_verification","challenge":"abc"}`)
	now := time.Now()
	tsStr := strconv.FormatInt(now.Unix(), 10)

	header := http.Header{}
	header.Set("X-Slack-Request-Timestamp", tsStr)
	header.Set("X-Slack-Signature", sign(secret, tsStr, body))

	if err := verifySlackSignature(secret, header, body, now); err != nil {
		t.Fatalf("expected valid signature, got error: %v", err)
	}
}

func TestVerifySlackSignature_Invalid(t *testing.T) {
	header := http.Header{}
	header.Set("X-Slack-Request-Timestamp", strconv.FormatInt(time.Now().Unix(), 10))
	header.Set("X-Slack-Signature", "v0=deadbeef")

	if err := verifySlackSignature("secret", header, []byte("body"), time.Now()); err == nil {
		t.Fatal("expected error for invalid signature, got nil")
	}
}

func TestVerifySlackSignature_TooOld(t *testing.T) {
	secret := "test-signing-secret"
	body := []byte("body")
	old := time.Now().Add(-10 * time.Minute)
	tsStr := strconv.FormatInt(old.Unix(), 10)

	header := http.Header{}
	header.Set("X-Slack-Request-Timestamp", tsStr)
	header.Set("X-Slack-Signature", sign(secret, tsStr, body))

	if err := verifySlackSignature(secret, header, body, time.Now()); err == nil {
		t.Fatal("expected error for stale timestamp, got nil")
	}
}

func TestStripMention(t *testing.T) {
	cases := map[string]string{
		"<@U123ABC> investigate the frontend pod": "investigate the frontend pod",
		"<@U123ABC><@U456DEF> investigate":        "investigate",
		"no mention here":                         "no mention here",
	}
	for input, want := range cases {
		if got := stripMention(input); got != want {
			t.Errorf("stripMention(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestBuildAskWithHistory(t *testing.T) {
	history := []slackMessage{
		{Text: "frontend pods are crashlooping", User: "U1"},
		{Text: "started 10 minutes ago", User: "U1"},
	}
	got := buildAskWithHistory(history, "what's the root cause?")
	if !strings.Contains(got, "frontend pods are crashlooping") {
		t.Errorf("expected history text in result, got: %s", got)
	}
	if !strings.Contains(got, "what's the root cause?") {
		t.Errorf("expected ask text in result, got: %s", got)
	}
}
