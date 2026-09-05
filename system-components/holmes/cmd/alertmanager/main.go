package main

import (
	"log"
	"net/http"

	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/holmes"
	"github.com/panicboat/monorepo/system-components/holmes/internal/clients/slack"
	"github.com/panicboat/monorepo/system-components/holmes/internal/config"
	"github.com/panicboat/monorepo/system-components/holmes/internal/handlers/alertmanager"
)

func main() {
	cfg, err := config.LoadAlertmanager()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	holmesClient := holmes.New(cfg.HolmesAPIURL, cfg.HolmesModel)
	slackClient := slack.New(cfg.SlackBotToken)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/alertmanager/webhook", &alertmanager.Handler{Cfg: cfg, Holmes: holmesClient, Client: slackClient})

	addr := ":8080"
	log.Printf("holmes-alertmanager listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
