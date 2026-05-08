package httpx

import "net/http"

func WriteError(w http.ResponseWriter, status int, code string, message string) {
	WriteJSON(w, status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
