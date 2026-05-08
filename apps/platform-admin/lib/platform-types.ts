export type OverviewResponse = {
  stats: {
    total_tenants: number;
    paid_tenants: number;
    free_tenants: number;
    estimated_mrr_idr: number;
    total_outlets: number;
    total_customers: number;
    total_visits_30d: number;
    pending_reminders_7d: number;
  };
  tenants: Array<{
    id: string;
    name: string;
    status: string;
    plan_code: string;
    outlets: number;
    customers: number;
    barbers: number;
    stations: number;
    visits_30d: number;
    revenue_30d_idr: number;
    public_queue_id: string;
  }>;
  recent_logs: Array<{
    id: string;
    tenant_id: string;
    action: string;
    target_type: string;
    target_id: string;
    created_at: string;
  }>;
};

export type TenantsResponse = {
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    plan_code: string;
    outlets: number;
    customers: number;
    barbers: number;
    stations: number;
    visits_30d: number;
    revenue_30d_idr: number;
    public_queue_id: string;
    created_at: string;
    current_period_end?: string;
  }>;
};

export type PlansResponse = {
  plans: Array<{
    code: string;
    name: string;
    description: string;
    is_free: boolean;
    monthly_price_idr: number;
    yearly_price_idr: number;
    billing_cycle_days: number;
    max_outlets: number;
    max_users: number;
    max_customers: number;
    max_reminders_per_month: number;
    max_whatsapp_sessions: number;
    allow_campaigns: boolean;
    allow_loyalty: boolean;
    allow_exports: boolean;
    allow_multi_outlet: boolean;
  }>;
};

export type SystemStatusResponse = {
  database: string;
  last_checked_at: string;
  total_queue_waiting: number;
  total_queue_serving: number;
  active_stations: number;
  barbers_on_shift: number;
};

export type AuditLogsResponse = {
  audit_logs: Array<{
    id: string;
    tenant_id: string;
    action: string;
    target_type: string;
    target_id: string;
    created_at: string;
  }>;
};

export type PlatformDataset = {
  overview: OverviewResponse;
  tenants: TenantsResponse;
  plans: PlansResponse;
  systemStatus: SystemStatusResponse;
  auditLogs: AuditLogsResponse;
  billingOrders: {
    orders: Array<{
      id: string;
      tenant_id: string;
      tenant_name: string;
      plan_code: string;
      plan_name: string;
      billing_cycle: string;
      billing_cycle_days: number;
      base_amount_idr: number;
      coupon_code: string;
      discount_type: string;
      discount_value: number;
      discount_amount_idr: number;
      total_amount_idr: number;
      payment_channel: string;
      status: string;
      notes: string;
      created_at: string;
      paid_at?: string;
    }>;
  };
};

export function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
