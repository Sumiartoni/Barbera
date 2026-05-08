package handlers

import (
	"net/http"

	"balikcukur/pkg/httpx"
)

func Live(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"check":  "live",
	})
}

func Ready(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"check":  "ready",
	})
}
