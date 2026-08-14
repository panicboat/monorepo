package main

import (
	"log"
	"net/http"
)

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	holmes := NewHolmesClient(cfg.HolmesAPIURL, cfg.HolmesModel)
	slackClient := newSlackAPIClient(cfg.SlackBotToken)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/slack/events", &slackHandler{cfg: cfg, holmes: holmes, client: slackClient})
	mux.Handle("/alertmanager/webhook", &alertmanagerHandler{cfg: cfg, holmes: holmes, client: slackClient})

	addr := ":8080"
	log.Printf("holmes-relay listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
