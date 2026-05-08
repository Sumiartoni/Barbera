package bootstrap

import (
	"database/sql"
	"net/http"
	"time"

	httplayer "balikcukur/internal/http"
	"balikcukur/pkg/config"
	"balikcukur/pkg/database"
	"balikcukur/pkg/logger"
)

type API struct {
	cfg    config.Config
	db     *sql.DB
	server *http.Server
}

func NewAPI() (*API, error) {
	cfg := config.Load()
	log := logger.New(cfg.App.Env, cfg.App.Name)
	db, err := database.Connect(cfg.Postgres)
	if err != nil {
		return nil, err
	}

	handler := httplayer.NewRouter(cfg, log, db)

	server := &http.Server{
		Addr:              cfg.HTTP.BindAddress,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       cfg.HTTP.ReadTimeout,
		WriteTimeout:      cfg.HTTP.WriteTimeout,
		IdleTimeout:       cfg.HTTP.IdleTimeout,
	}

	return &API{
		cfg:    cfg,
		db:     db,
		server: server,
	}, nil
}

func (a *API) Run() error {
	defer a.db.Close()
	return a.server.ListenAndServe()
}
