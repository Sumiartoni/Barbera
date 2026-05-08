package main

import (
	"log"

	"balikcukur/internal/bootstrap"
)

func main() {
	app, err := bootstrap.NewAPI()
	if err != nil {
		log.Fatalf("bootstrap api: %v", err)
	}

	if err := app.Run(); err != nil {
		log.Fatalf("run api: %v", err)
	}
}
