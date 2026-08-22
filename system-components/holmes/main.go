package main

import (
	"log"
	"net/http"

	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/github"
	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/holmes"
	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
	"github.com/panicboat/monorepo/system-components/holmes/internal/handlers/alertmanager"
	slackhandler "github.com/panicboat/monorepo/system-components/holmes/internal/handlers/slack"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	holmesClient := holmes.New(cfg.HolmesAPIURL, cfg.HolmesModel)
	slackClient := slack.New(cfg.SlackBotToken)
	githubClient, err := github.New(cfg.GitHubAppID, cfg.GitHubAppPrivateKey, cfg.GitHubAppInstallationID)
	if err != nil {
		log.Fatalf("github client error: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/slack/events", &slackhandler.Handler{Cfg: cfg, Holmes: holmesClient, Client: slackClient, GitHub: githubClient})
	mux.Handle("/alertmanager/webhook", &alertmanager.Handler{Cfg: cfg, Holmes: holmesClient, Client: slackClient})

	addr := ":8080"
	log.Printf("holmes listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
