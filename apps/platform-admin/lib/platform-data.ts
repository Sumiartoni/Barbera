import { platformRequest } from "./platform-api";
import type {
  AuditLogsResponse,
  OverviewResponse,
  PlansResponse,
  PlatformDataset,
  SystemStatusResponse,
  TenantsResponse,
} from "./platform-types";

export async function loadPlatformDataset(): Promise<PlatformDataset> {
  const results = await Promise.allSettled([
    platformRequest<OverviewResponse>("/api/v1/platform/overview"),
    platformRequest<TenantsResponse>("/api/v1/platform/tenants?limit=50"),
    platformRequest<PlansResponse>("/api/v1/platform/plans"),
    platformRequest<SystemStatusResponse>("/api/v1/platform/system-status"),
    platformRequest<AuditLogsResponse>("/api/v1/platform/audit-logs?limit=50"),
    platformRequest<PlatformDataset["billingOrders"]>("/api/v1/platform/billing-orders?limit=100"),
  ]);

  const overview = pickResult(results[0], {
    stats: {
      total_tenants: 0,
      paid_tenants: 0,
      free_tenants: 0,
      estimated_mrr_idr: 0,
      total_outlets: 0,
      total_customers: 0,
      total_visits_30d: 0,
      pending_reminders_7d: 0,
    },
    tenants: [],
    recent_logs: [],
  });
  const tenants = pickResult(results[1], { tenants: [] });
  const plans = pickResult(results[2], { plans: [] });
  const systemStatus = pickResult(results[3], {
    database: "unknown",
    last_checked_at: new Date(0).toISOString(),
    total_queue_waiting: 0,
    total_queue_serving: 0,
    active_stations: 0,
    barbers_on_shift: 0,
  });
  const auditLogs = pickResult(results[4], { audit_logs: [] });
  const billingOrders = pickResult(results[5], { orders: [] });

  return {
    overview,
    tenants,
    plans,
    systemStatus,
    auditLogs,
    billingOrders,
  };
}

function pickResult<T>(result: PromiseSettledResult<T>, fallback: T): T {
  if (result.status === "fulfilled") {
    return result.value;
  }
  return fallback;
}
