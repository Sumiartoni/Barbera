package httpx

import "net/http"

type Middleware func(http.Handler) http.Handler

func Chain(handler http.Handler, middlewares ...Middleware) http.Handler {
	wrapped := handler

	for index := len(middlewares) - 1; index >= 0; index-- {
		wrapped = middlewares[index](wrapped)
	}

	return wrapped
}
