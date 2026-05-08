package httplayer

import (
	"database/sql"
	"log/slog"
	"net/http"

	"balikcukur/internal/http/handlers"
	httpmiddleware "balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/audit"
	"balikcukur/internal/modules/auth"
	"balikcukur/internal/modules/barbers"
	"balikcukur/internal/modules/billing"
	"balikcukur/internal/modules/customers"
	"balikcukur/internal/modules/outlets"
	"balikcukur/internal/modules/ownercommands"
	"balikcukur/internal/modules/plans"
	"balikcukur/internal/modules/platform"
	"balikcukur/internal/modules/queue"
	"balikcukur/internal/modules/reports"
	"balikcukur/internal/modules/resources"
	"balikcukur/internal/modules/shifts"
	"balikcukur/internal/modules/staffaccess"
	"balikcukur/internal/modules/stations"
	"balikcukur/internal/modules/teammembers"
	"balikcukur/internal/modules/usage"
	"balikcukur/internal/modules/visits"
	"balikcukur/internal/modules/whatsapp"
	"balikcukur/pkg/config"
	"balikcukur/pkg/httpx"
)

func NewRouter(cfg config.Config, logger *slog.Logger, db *sql.DB) http.Handler {
	mux := http.NewServeMux()
	plansService := plans.NewService(db)
	authService := auth.NewService(db, cfg.Auth.JWTSigningKey, cfg.Auth.AccessTokenTTL, cfg.App.PublicURL)
	auditService := audit.NewService(db)
	outletsService := outlets.NewService(db)
	billingService := billing.NewService(db)
	staffAccessService := staffaccess.NewService(db, authService, cfg.App.PublicURL)
	barbersService := barbers.NewService(db)
	stationsService := stations.NewService(db)
	shiftsService := shifts.NewService(db)
	queueService := queue.NewService(db, cfg.App.PublicURL)
	customersService := customers.NewService(db)
	ownerCommandsService := ownercommands.NewService(barbersService, customersService, queueService, shiftsService)
	resourcesService := resources.NewService(db)
	usageService := usage.NewService(db)
	visitsService := visits.NewService(db)
	reportsService := reports.NewService(db)
	platformService := platform.NewService(db)
	teamMembersService := teammembers.NewService(db)
	whatsAppService := whatsapp.NewService(db, logger, ownerCommandsService, barbersService, queueService)
	plansHandler := handlers.NewPlansHandler(plansService)
	authHandler := handlers.NewAuthHandler(authService)
	staffAccessHandler := handlers.NewStaffAccessHandler(staffAccessService)
	barbersHandler := handlers.NewBarbersHandler(barbersService)
	stationsHandler := handlers.NewStationsHandler(stationsService)
	shiftsHandler := handlers.NewShiftsHandler(shiftsService)
	queueHandler := handlers.NewQueueHandler(queueService)
	publicQueueHandler := handlers.NewPublicQueueHandler(queueService)
	ownerCommandsHandler := handlers.NewOwnerCommandsHandler(ownerCommandsService)
	customersHandler := handlers.NewCustomersHandler(customersService)
	outletsHandler := handlers.NewOutletsHandler(outletsService)
	tenantResourcesHandler := handlers.NewTenantResourcesHandler(resourcesService)
	tenantConfigHandler := handlers.NewTenantConfigHandler(resourcesService)
	billingHandler := handlers.NewBillingHandler(billingService)
	usageHandler := handlers.NewUsageHandler(usageService)
	tenantAuditLogsHandler := handlers.NewTenantAuditLogsHandler(auditService)
	visitsHandler := handlers.NewVisitsHandler(visitsService)
	dashboardHandler := handlers.NewDashboardHandler(reportsService)
	platformHandler := handlers.NewPlatformHandler(platformService, plansService, billingService)
	platformResourcesHandler := handlers.NewPlatformResourcesHandler(resourcesService)
	platformConfigHandler := handlers.NewPlatformConfigHandler(resourcesService)
	teamMembersHandler := handlers.NewTeamMembersHandler(teamMembersService)
	whatsAppHandler := handlers.NewWhatsAppHandler(whatsAppService)
	authRequired := httpmiddleware.RequireAuth(authService)
	platformAdminRequired := httpmiddleware.RequirePlatformAdminKey(cfg.Platform.AdminAPIKey)

	mux.HandleFunc("GET /health/live", handlers.Live)
	mux.HandleFunc("GET /health/ready", handlers.Ready)
	mux.HandleFunc("GET /api/v1/public/plans", plansHandler.ListPublic)
	mux.HandleFunc("GET /api/v1/public/queue/{publicQueueID}", publicQueueHandler.Show)
	mux.HandleFunc("POST /api/v1/public/whatsapp/owner-command/{publicQueueID}", whatsAppHandler.PublicOwnerCommand)
	mux.HandleFunc("POST /api/v1/public/payments/manual-qris-forwarder", billingHandler.PublicManualQRISForwarder)
	mux.HandleFunc("POST /api/v1/auth/register", authHandler.Register)
	mux.HandleFunc("POST /api/v1/auth/login", authHandler.Login)
	mux.HandleFunc("POST /api/v1/pos/auth/login", staffAccessHandler.POSLogin)
	mux.Handle("GET /api/v1/auth/me", authRequired(http.HandlerFunc(authHandler.Me)))
	mux.Handle("GET /api/v1/pos/auth/me", authRequired(http.HandlerFunc(staffAccessHandler.POSMe)))
	mux.Handle("GET /api/v1/dashboard/summary", authRequired(http.HandlerFunc(dashboardHandler.Summary)))
	mux.Handle("GET /api/v1/barbers", authRequired(http.HandlerFunc(barbersHandler.List)))
	mux.Handle("POST /api/v1/barbers", authRequired(http.HandlerFunc(barbersHandler.Create)))
	mux.Handle("PUT /api/v1/barbers/{barberID}", authRequired(http.HandlerFunc(barbersHandler.Update)))
	mux.Handle("GET /api/v1/barber-access", authRequired(http.HandlerFunc(staffAccessHandler.List)))
	mux.Handle("POST /api/v1/barber-access", authRequired(http.HandlerFunc(staffAccessHandler.Provision)))
	mux.Handle("PUT /api/v1/barber-access/{accountID}", authRequired(http.HandlerFunc(staffAccessHandler.Update)))
	mux.Handle("GET /api/v1/stations", authRequired(http.HandlerFunc(stationsHandler.List)))
	mux.Handle("POST /api/v1/stations", authRequired(http.HandlerFunc(stationsHandler.Create)))
	mux.Handle("PUT /api/v1/stations/{stationID}", authRequired(http.HandlerFunc(stationsHandler.Update)))
	mux.Handle("GET /api/v1/shifts", authRequired(http.HandlerFunc(shiftsHandler.List)))
	mux.Handle("POST /api/v1/shifts", authRequired(http.HandlerFunc(shiftsHandler.Create)))
	mux.Handle("PUT /api/v1/shifts/{shiftID}", authRequired(http.HandlerFunc(shiftsHandler.Update)))
	mux.Handle("GET /api/v1/customers", authRequired(http.HandlerFunc(customersHandler.List)))
	mux.Handle("POST /api/v1/customers", authRequired(http.HandlerFunc(customersHandler.Create)))
	mux.Handle("PUT /api/v1/customers/{customerID}", authRequired(http.HandlerFunc(customersHandler.Update)))
	mux.Handle("GET /api/v1/outlets", authRequired(http.HandlerFunc(outletsHandler.List)))
	mux.Handle("POST /api/v1/outlets", authRequired(http.HandlerFunc(outletsHandler.Create)))
	mux.Handle("PUT /api/v1/outlets/{outletID}", authRequired(http.HandlerFunc(outletsHandler.Update)))
	mux.Handle("GET /api/v1/team-members", authRequired(http.HandlerFunc(teamMembersHandler.List)))
	mux.Handle("POST /api/v1/team-members", authRequired(http.HandlerFunc(teamMembersHandler.Create)))
	mux.Handle("PUT /api/v1/team-members/{membershipID}", authRequired(http.HandlerFunc(teamMembersHandler.Update)))
	mux.Handle("GET /api/v1/resources/{resourceType}", authRequired(http.HandlerFunc(tenantResourcesHandler.List)))
	mux.Handle("POST /api/v1/resources/{resourceType}", authRequired(http.HandlerFunc(tenantResourcesHandler.Create)))
	mux.Handle("PUT /api/v1/resources/{resourceType}/{itemID}", authRequired(http.HandlerFunc(tenantResourcesHandler.Update)))
	mux.Handle("DELETE /api/v1/resources/{resourceType}/{itemID}", authRequired(http.HandlerFunc(tenantResourcesHandler.Delete)))
	mux.Handle("GET /api/v1/config/{configType}", authRequired(http.HandlerFunc(tenantConfigHandler.Get)))
	mux.Handle("PUT /api/v1/config/{configType}", authRequired(http.HandlerFunc(tenantConfigHandler.Put)))
	mux.Handle("GET /api/v1/billing/summary", authRequired(http.HandlerFunc(billingHandler.Summary)))
	mux.HandleFunc("GET /api/v1/billing/catalog", billingHandler.Catalog)
	mux.Handle("GET /api/v1/billing/orders", authRequired(http.HandlerFunc(billingHandler.ListOrders)))
	mux.Handle("POST /api/v1/billing/orders", authRequired(http.HandlerFunc(billingHandler.CreateOrder)))
	mux.Handle("GET /api/v1/usage/summary", authRequired(http.HandlerFunc(usageHandler.Summary)))
	mux.Handle("GET /api/v1/audit-logs", authRequired(http.HandlerFunc(tenantAuditLogsHandler.List)))
	mux.Handle("GET /api/v1/queue", authRequired(http.HandlerFunc(queueHandler.ListActive)))
	mux.Handle("POST /api/v1/queue", authRequired(http.HandlerFunc(queueHandler.Create)))
	mux.Handle("POST /api/v1/queue/{ticketID}/status", authRequired(http.HandlerFunc(queueHandler.UpdateStatus)))
	mux.Handle("GET /api/v1/visits", authRequired(http.HandlerFunc(visitsHandler.List)))
	mux.Handle("POST /api/v1/visits", authRequired(http.HandlerFunc(visitsHandler.Create)))
	mux.Handle("POST /api/v1/owner-tools/shift-command", authRequired(http.HandlerFunc(ownerCommandsHandler.ExecuteShiftCommand)))
	mux.Handle("GET /api/v1/whatsapp/overview", authRequired(http.HandlerFunc(whatsAppHandler.Overview)))
	mux.Handle("GET /api/v1/whatsapp/logs", authRequired(http.HandlerFunc(whatsAppHandler.Logs)))
	mux.Handle("POST /api/v1/whatsapp/execute", authRequired(http.HandlerFunc(whatsAppHandler.Execute)))
	mux.Handle("PUT /api/v1/whatsapp/config", authRequired(http.HandlerFunc(whatsAppHandler.PutConfig)))
	mux.Handle("POST /api/v1/whatsapp/session/pair-qr", authRequired(http.HandlerFunc(whatsAppHandler.StartQRPairing)))
	mux.Handle("POST /api/v1/whatsapp/session/pair-phone", authRequired(http.HandlerFunc(whatsAppHandler.PairPhone)))
	mux.Handle("POST /api/v1/whatsapp/session/connect", authRequired(http.HandlerFunc(whatsAppHandler.ConnectSession)))
	mux.Handle("POST /api/v1/whatsapp/session/disconnect", authRequired(http.HandlerFunc(whatsAppHandler.DisconnectSession)))
	mux.Handle("POST /api/v1/whatsapp/session/send-test", authRequired(http.HandlerFunc(whatsAppHandler.SendTestMessage)))
	mux.Handle("GET /api/v1/platform/overview", platformAdminRequired(http.HandlerFunc(platformHandler.Overview)))
	mux.Handle("GET /api/v1/platform/tenants", platformAdminRequired(http.HandlerFunc(platformHandler.Tenants)))
	mux.Handle("POST /api/v1/platform/tenants/{tenantID}/plan", platformAdminRequired(http.HandlerFunc(platformHandler.AssignTenantPlan)))
	mux.Handle("POST /api/v1/platform/tenants/{tenantID}/status", platformAdminRequired(http.HandlerFunc(platformHandler.UpdateTenantStatus)))
	mux.Handle("GET /api/v1/platform/plans", platformAdminRequired(http.HandlerFunc(platformHandler.Plans)))
	mux.Handle("PUT /api/v1/platform/plans/{planCode}", platformAdminRequired(http.HandlerFunc(platformHandler.UpdatePlan)))
	mux.Handle("GET /api/v1/platform/billing-orders", platformAdminRequired(http.HandlerFunc(platformHandler.BillingOrders)))
	mux.Handle("POST /api/v1/platform/billing-orders/{orderID}/status", platformAdminRequired(http.HandlerFunc(platformHandler.UpdateBillingOrderStatus)))
	mux.Handle("GET /api/v1/platform/resources/{resourceType}", platformAdminRequired(http.HandlerFunc(platformResourcesHandler.List)))
	mux.Handle("POST /api/v1/platform/resources/{resourceType}", platformAdminRequired(http.HandlerFunc(platformResourcesHandler.Create)))
	mux.Handle("PUT /api/v1/platform/resources/{resourceType}/{itemID}", platformAdminRequired(http.HandlerFunc(platformResourcesHandler.Update)))
	mux.Handle("DELETE /api/v1/platform/resources/{resourceType}/{itemID}", platformAdminRequired(http.HandlerFunc(platformResourcesHandler.Delete)))
	mux.Handle("GET /api/v1/platform/config/{configType}", platformAdminRequired(http.HandlerFunc(platformConfigHandler.Get)))
	mux.Handle("PUT /api/v1/platform/config/{configType}", platformAdminRequired(http.HandlerFunc(platformConfigHandler.Put)))
	mux.Handle("GET /api/v1/platform/system-status", platformAdminRequired(http.HandlerFunc(platformHandler.SystemStatus)))
	mux.Handle("GET /api/v1/platform/audit-logs", platformAdminRequired(http.HandlerFunc(platformHandler.AuditLogs)))

	return httpx.Chain(
		mux,
		httpmiddleware.Recovery(logger),
		httpmiddleware.RequestID(),
		httpmiddleware.CORS(cfg.Security),
		httpmiddleware.SecurityHeaders(cfg.Security),
		httpmiddleware.RateLimit(cfg.Security.RateLimit, logger),
		httpmiddleware.TenantScope(),
	)
}
