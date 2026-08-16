package github

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"testing"
)

func testPrivateKeyPEM(t *testing.T) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate test key: %v", err)
	}
	block := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}
	return string(pem.EncodeToMemory(block))
}

func TestNew_InvalidPrivateKey(t *testing.T) {
	if _, err := New("1", "not a pem block", "2"); err == nil {
		t.Fatal("expected error for invalid private key, got nil")
	}
}

func TestClient_CreateIssue_Success(t *testing.T) {
	var tokenRequests int
	var gotJWTAuth, gotInstallationAuth string
	var gotIssueBody map[string]string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/app/installations/999/access_tokens":
			tokenRequests++
			gotJWTAuth = r.Header.Get("Authorization")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{
				"token":      "installation-token",
				"expires_at": "2099-01-01T00:00:00Z",
			})
		case r.Method == http.MethodPost && r.URL.Path == "/repos/panicboat/monorepo/issues":
			gotInstallationAuth = r.Header.Get("Authorization")
			json.NewDecoder(r.Body).Decode(&gotIssueBody)
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{"html_url": "https://github.com/panicboat/monorepo/issues/1"})
		default:
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client, err := New("123", testPrivateKeyPEM(t), "999")
	if err != nil {
		t.Fatalf("unexpected error from New: %v", err)
	}
	client.BaseURL = server.URL

	url, err := client.CreateIssue("panicboat/monorepo", "found a bug", "details here")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url != "https://github.com/panicboat/monorepo/issues/1" {
		t.Errorf("got url %q, want %q", url, "https://github.com/panicboat/monorepo/issues/1")
	}
	if gotJWTAuth == "" || gotJWTAuth == "Bearer installation-token" {
		t.Errorf("expected the token-exchange request to carry the app JWT, got %q", gotJWTAuth)
	}
	if gotInstallationAuth != "Bearer installation-token" {
		t.Errorf("expected the issue-creation request to carry the installation token, got %q", gotInstallationAuth)
	}
	if gotIssueBody["title"] != "found a bug" || gotIssueBody["body"] != "details here" {
		t.Errorf("unexpected issue body sent: %+v", gotIssueBody)
	}
	if tokenRequests != 1 {
		t.Errorf("expected exactly 1 token-exchange request, got %d", tokenRequests)
	}
}

func TestClient_CreateIssue_TokenCachedAcrossCalls(t *testing.T) {
	var tokenRequests int

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/app/installations/999/access_tokens":
			tokenRequests++
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{
				"token":      "installation-token",
				"expires_at": "2099-01-01T00:00:00Z",
			})
		case r.URL.Path == "/repos/panicboat/monorepo/issues":
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{"html_url": "https://github.com/panicboat/monorepo/issues/1"})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client, err := New("123", testPrivateKeyPEM(t), "999")
	if err != nil {
		t.Fatalf("unexpected error from New: %v", err)
	}
	client.BaseURL = server.URL

	if _, err := client.CreateIssue("panicboat/monorepo", "t1", "b1"); err != nil {
		t.Fatalf("unexpected error on first call: %v", err)
	}
	if _, err := client.CreateIssue("panicboat/monorepo", "t2", "b2"); err != nil {
		t.Fatalf("unexpected error on second call: %v", err)
	}
	if tokenRequests != 1 {
		t.Errorf("expected the cached token to be reused, got %d token requests", tokenRequests)
	}
}

func TestClient_CreateIssue_GitHubError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/app/installations/999/access_tokens":
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{
				"token":      "installation-token",
				"expires_at": "2099-01-01T00:00:00Z",
			})
		case "/repos/panicboat/does-not-exist/issues":
			w.WriteHeader(http.StatusNotFound)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client, err := New("123", testPrivateKeyPEM(t), "999")
	if err != nil {
		t.Fatalf("unexpected error from New: %v", err)
	}
	client.BaseURL = server.URL

	if _, err := client.CreateIssue("panicboat/does-not-exist", "t", "b"); err == nil {
		t.Fatal("expected an error for a 404 response, got nil")
	}
}
