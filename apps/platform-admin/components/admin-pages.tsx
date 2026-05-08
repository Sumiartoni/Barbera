import Link from "next/link";
import type { AdminSectionId } from "../lib/admin-navigation";
import { formatIDR, type PlatformDataset } from "../lib/platform-types";
import { BillingOrderStatusManager } from "./billing-order-status-manager";
import { PlanManagementPanel } from "./plan-management-panel";
import { PlatformConfigManager, PlatformResourceManager } from "./platform-module-manager";
import { TenantPlanManager } from "./tenant-plan-manager";
import { TenantStatusManager } from "./tenant-status-manager";

function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-800/50 mb-6">
      <div>
        <p className="text-xs font-bold tracking-widest text-[#C8A464] mb-2 uppercase">{eyebrow}</p>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">{title}</h1>
        <p className="text-zinc-400 max-w-3xl text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  desc,
}: {
  label: string;
  value: string;
  desc: string;
}) {
  return (
    <article className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5">
      <span className="block text-sm text-zinc-400 font-medium mb-1">{label}</span>
      <strong className="block text-2xl font-bold text-white mb-1">{value}</strong>
      <p className="text-xs text-zinc-500">{desc}</p>
    </article>
  );
}

function Card({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-zinc-800">
        {eyebrow ? (
          <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase mb-1">{eyebrow}</p>
        ) : null}
        <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </article>
  );
}

function EmptyModule({
  title,
  description,
  checklist,
}: {
  title: string;
  description: string;
  checklist: string[];
}) {
  return (
    <Card title={title} eyebrow="Module">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {checklist.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function sortTenantsByFocus<T extends { id: string; name: string }>(items: T[], focusTenantID?: string) {
  if (!focusTenantID) {
    return items;
  }

  return [...items].sort((left, right) => {
    if (left.id === focusTenantID) return -1;
    if (right.id === focusTenantID) return 1;
    return left.name.localeCompare(right.name);
  });
}

function QuickRouteLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800"
    >
      {label}
    </Link>
  );
}

function TenantsTable({
  data,
  compact = false,
  focusTenantID,
  actionMode = "tenants",
}: {
  data: PlatformDataset["tenants"]["tenants"];
  compact?: boolean;
  focusTenantID?: string;
  actionMode?: "tenants" | "overview";
}) {
  const rows = sortTenantsByFocus(data, focusTenantID);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tenant</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Paket</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Outlet</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Customer</th>
            {!compact ? (
              <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Barber / Station</th>
            ) : null}
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Visits 30D</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Revenue</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {rows.map((tenant) => (
            <tr
              key={tenant.id}
              className={`hover:bg-zinc-800/30 transition-colors ${focusTenantID === tenant.id ? "bg-zinc-800/20" : ""}`}
            >
              <td className="px-4 py-4">
                <strong className="text-sm font-bold text-zinc-200 block">{tenant.name}</strong>
                <p className="text-xs text-zinc-500 mt-1">{tenant.public_queue_id}</p>
              </td>
              <td className="px-4 py-4">
                <span className="inline-flex rounded-full border border-zinc-700 px-2.5 py-1 text-xs uppercase text-zinc-300">
                  {tenant.status}
                </span>
              </td>
              <td className="px-4 py-4 text-sm text-zinc-300 uppercase">{tenant.plan_code}</td>
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.outlets}</td>
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.customers}</td>
              {!compact ? (
                <td className="px-4 py-4 text-sm text-zinc-400">
                  {tenant.barbers} barber • {tenant.stations} station
                </td>
              ) : null}
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.visits_30d}</td>
              <td className="px-4 py-4 text-right text-sm font-semibold text-zinc-100">
                {formatIDR(tenant.revenue_30d_idr)}
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <QuickRouteLink href={`/internal-admin/tenant-detail?tenant=${tenant.id}`} label="Detail" />
                  <QuickRouteLink
                    href={
                      actionMode === "overview"
                        ? `/internal-admin/subscriptions?tenant=${tenant.id}`
                        : `/internal-admin/tenant-override?tenant=${tenant.id}`
                    }
                    label={actionMode === "overview" ? "Langganan" : "Override"}
                  />
                  <QuickRouteLink href={`/internal-admin/suspension?tenant=${tenant.id}`} label="Status" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TenantLifecycleTable({
  data,
  focusTenantID,
}: {
  data: PlatformDataset["tenants"]["tenants"];
  focusTenantID?: string;
}) {
  const rows = sortTenantsByFocus(data, focusTenantID);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tenant</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Queue ID</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Plan</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Outlet</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Dibuat</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {rows.map((tenant) => (
            <tr
              key={tenant.id}
              className={`hover:bg-zinc-800/30 transition-colors ${focusTenantID === tenant.id ? "bg-zinc-800/20" : ""}`}
            >
              <td className="px-4 py-4">
                <strong className="block text-sm font-bold text-zinc-200">{tenant.name}</strong>
                <span className="text-xs text-zinc-500">{tenant.slug}</span>
              </td>
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.public_queue_id}</td>
              <td className="px-4 py-4 text-sm uppercase text-zinc-300">{tenant.plan_code}</td>
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.outlets}</td>
              <td className="px-4 py-4 text-sm text-zinc-400">
                {new Date(tenant.created_at).toLocaleDateString("id-ID")}
              </td>
              <td className="px-4 py-4">
                <span className="inline-flex rounded-full border border-zinc-700 px-2.5 py-1 text-xs uppercase text-zinc-300">
                  {tenant.status}
                </span>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <QuickRouteLink href={`/internal-admin/subscriptions?tenant=${tenant.id}`} label="Langganan" />
                  <QuickRouteLink href={`/internal-admin/payments?tenant=${tenant.id}`} label="Payments" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TenantSubscriptionTable({
  data,
}: {
  data: PlatformDataset["tenants"]["tenants"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tenant</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Plan</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Outlet</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Visits 30D</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Periode</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Revenue 30D</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {data.map((tenant) => (
            <tr key={tenant.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-4">
                <strong className="block text-sm font-bold text-zinc-200">{tenant.name}</strong>
                <span className="text-xs text-zinc-500">{tenant.public_queue_id}</span>
              </td>
              <td className="px-4 py-4 text-sm uppercase text-zinc-300">{tenant.plan_code}</td>
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.outlets}</td>
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.visits_30d}</td>
              <td className="px-4 py-4 text-sm text-zinc-400">
                {tenant.current_period_end
                  ? new Date(tenant.current_period_end).toLocaleDateString("id-ID")
                  : "Tidak dibatasi"}
              </td>
              <td className="px-4 py-4 text-right text-sm font-semibold text-zinc-100">
                {formatIDR(tenant.revenue_30d_idr)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TenantPaymentsTable({
  data,
  focusTenantID,
}: {
  data: PlatformDataset["tenants"]["tenants"];
  focusTenantID?: string;
}) {
  const rows = sortTenantsByFocus(data, focusTenantID);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tenant</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Plan</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Customer</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Visits 30D</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Queue ID</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Omzet 30D</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {rows.map((tenant) => (
            <tr
              key={tenant.id}
              className={`hover:bg-zinc-800/30 transition-colors ${focusTenantID === tenant.id ? "bg-zinc-800/20" : ""}`}
            >
              <td className="px-4 py-4">
                <strong className="block text-sm font-bold text-zinc-200">{tenant.name}</strong>
                <span className="text-xs text-zinc-500">{tenant.slug}</span>
              </td>
              <td className="px-4 py-4 text-sm uppercase text-zinc-300">{tenant.plan_code}</td>
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.customers}</td>
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.visits_30d}</td>
              <td className="px-4 py-4 text-sm text-zinc-400">{tenant.public_queue_id}</td>
              <td className="px-4 py-4 text-right text-sm font-semibold text-zinc-100">
                {formatIDR(tenant.revenue_30d_idr)}
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <QuickRouteLink href={`/internal-admin/invoices?tenant=${tenant.id}`} label="Invoices" />
                  <QuickRouteLink href={`/internal-admin/manual-confirmation?tenant=${tenant.id}`} label="Confirm" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TenantControlTable({
  data,
  mode,
}: {
  data: PlatformDataset["tenants"]["tenants"];
  mode: "override" | "suspension";
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tenant</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Plan</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Outlet</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Customer</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {mode === "override" ? "Arah konfigurasi" : "Arah tindakan"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {data.map((tenant) => (
            <tr key={tenant.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-4">
                <strong className="block text-sm font-bold text-zinc-200">{tenant.name}</strong>
                <span className="text-xs text-zinc-500">{tenant.public_queue_id}</span>
              </td>
              <td className="px-4 py-4 text-sm uppercase text-zinc-300">{tenant.plan_code}</td>
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.outlets}</td>
              <td className="px-4 py-4 text-sm text-zinc-300">{tenant.customers}</td>
              <td className="px-4 py-4">
                <span className="inline-flex rounded-full border border-zinc-700 px-2.5 py-1 text-xs uppercase text-zinc-300">
                  {tenant.status}
                </span>
              </td>
              <td className="px-4 py-4 text-sm text-zinc-400">
                {mode === "override"
                  ? tenant.plan_code === "free"
                    ? "Kandidat upsell ke Pro"
                    : "Siap limit custom / harga khusus"
                  : tenant.status === "active"
                    ? "Pantau atau suspend bila perlu"
                    : "Siap re-activate / review"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlansGrid({ plans }: { plans: PlatformDataset["plans"]["plans"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {plans.map((plan) => (
        <article key={plan.code} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <strong className="text-zinc-100 text-lg">{plan.name}</strong>
            <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] uppercase text-zinc-400">
              {plan.code}
            </span>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            {plan.description || "Belum ada deskripsi paket."}
          </p>
          <div className="space-y-2 text-sm text-zinc-300">
            <div className="flex justify-between gap-3">
              <span>Harga / bulan</span>
              <span>{plan.is_free ? "Gratis permanen" : formatIDR(plan.monthly_price_idr)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Maks user</span>
              <span>{plan.max_users}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Maks customer</span>
              <span>{plan.max_customers}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Maks reminder / bulan</span>
              <span>{plan.max_reminders_per_month}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function AuditLogList({ logs }: { logs: PlatformDataset["auditLogs"]["audit_logs"] }) {
  return (
    <div className="divide-y divide-zinc-800/50">
      {logs.map((entry) => (
        <div key={entry.id} className="py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-100">{entry.action}</p>
            <p className="text-xs text-zinc-500">
              {entry.target_type} • {entry.target_id}
            </p>
          </div>
          <p className="text-xs text-zinc-500 shrink-0">
            {new Date(entry.created_at).toLocaleString("id-ID")}
          </p>
        </div>
      ))}
    </div>
  );
}

function BillingOrdersTable({
  orders,
  focusTenantID,
}: {
  orders: PlatformDataset["billingOrders"]["orders"];
  focusTenantID?: string;
}) {
  const rows = [...orders].sort((left, right) => {
    if (focusTenantID) {
      if (left.tenant_id === focusTenantID) return -1;
      if (right.tenant_id === focusTenantID) return 1;
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tenant</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Paket</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Coupon</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Total</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Dibuat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {rows.map((order) => (
            <tr
              key={order.id}
              className={`hover:bg-zinc-800/30 transition-colors ${focusTenantID === order.tenant_id ? "bg-zinc-800/20" : ""}`}
            >
              <td className="px-4 py-4">
                <strong className="block text-sm font-bold text-zinc-200">{order.tenant_name}</strong>
                <span className="text-xs text-zinc-500">{order.tenant_id}</span>
              </td>
              <td className="px-4 py-4 text-sm text-zinc-300 uppercase">
                {order.plan_code} • {order.billing_cycle}
              </td>
              <td className="px-4 py-4 text-sm text-zinc-400">{order.coupon_code || "-"}</td>
              <td className="px-4 py-4 text-sm font-semibold text-zinc-100">{formatIDR(order.total_amount_idr)}</td>
              <td className="px-4 py-4 text-sm uppercase text-zinc-300">{order.status}</td>
              <td className="px-4 py-4 text-sm text-zinc-400">
                {new Date(order.created_at).toLocaleString("id-ID")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const platformResourceModules: Partial<
  Record<
    AdminSectionId,
    {
      resourceType: string;
      title: string;
      description: string;
      fields: Array<{ key: string; label: string; type: "text" | "number" | "textarea"; placeholder?: string }>;
    }
  >
> = {
  coupons: {
    resourceType: "coupon",
    title: "Coupon & Promo",
    description: "Kelola voucher platform, label promo, dan batas diskon tenant.",
    fields: [
      { key: "discount_type", label: "Tipe diskon", type: "text", placeholder: "percent|fixed" },
      { key: "discount_value", label: "Nilai diskon", type: "number", placeholder: "10" },
      { key: "applies_to", label: "Berlaku untuk", type: "text", placeholder: "all|pro,plus" },
      { key: "max_redemptions", label: "Batas penggunaan", type: "number", placeholder: "100" },
      { key: "max_discount_idr", label: "Maks diskon (opsional)", type: "number", placeholder: "50000" },
    ],
  },
  invoices: {
    resourceType: "invoice_note",
    title: "Invoice & Penagihan Internal",
    description: "Simpan catatan invoice platform, format invoice, atau catatan koleksi manual.",
    fields: [
      { key: "invoice_prefix", label: "Prefix invoice", type: "text", placeholder: "BAR-INV" },
      { key: "payment_window_days", label: "Jatuh tempo (hari)", type: "number", placeholder: "7" },
      { key: "notes", label: "Catatan", type: "textarea", placeholder: "Instruksi pembayaran invoice platform." },
    ],
  },
  "feature-flags": {
    resourceType: "feature_flag",
    title: "Feature Flags",
    description: "Aktif/nonaktifkan eksperimen dan fitur platform tanpa deploy ulang.",
    fields: [
      { key: "flag_key", label: "Key", type: "text", placeholder: "new-retention-widget" },
      { key: "enabled_for", label: "Target", type: "text", placeholder: "all|tenant:<id>" },
      { key: "notes", label: "Catatan", type: "textarea", placeholder: "Dipakai untuk tenant Pro beta." },
    ],
  },
  "admin-users": {
    resourceType: "admin_user",
    title: "Admin Users",
    description: "Kelola daftar admin internal yang boleh masuk ke panel super admin.",
    fields: [
      { key: "email", label: "Email", type: "text", placeholder: "ops@barbera.my.id" },
      { key: "role", label: "Role", type: "text", placeholder: "support" },
      { key: "notes", label: "Catatan", type: "textarea", placeholder: "Admin billing atau support." },
    ],
  },
  "incident-logs": {
    resourceType: "incident_log",
    title: "Incident Logs",
    description: "Catatan gangguan operasional, downtime, atau insiden tenant.",
    fields: [
      { key: "severity", label: "Severity", type: "text", placeholder: "high" },
      { key: "impact", label: "Impact", type: "text", placeholder: "payments delayed" },
      { key: "summary", label: "Ringkasan", type: "textarea", placeholder: "Deskripsi insiden." },
    ],
  },
  support: {
    resourceType: "support_ticket",
    title: "Support Tickets",
    description: "Area pencatatan tiket support internal sebelum helpdesk eksternal dipasang.",
    fields: [
      { key: "tenant_slug", label: "Tenant", type: "text", placeholder: "barbershop-jakarta" },
      { key: "priority", label: "Prioritas", type: "text", placeholder: "medium" },
      { key: "summary", label: "Ringkasan", type: "textarea", placeholder: "Tenant mengalami masalah login." },
    ],
  },
  announcements: {
    resourceType: "announcement",
    title: "Announcements",
    description: "Kelola pengumuman platform yang nanti bisa ditampilkan ke tenant.",
    fields: [
      { key: "audience", label: "Audience", type: "text", placeholder: "all-tenants" },
      { key: "starts_at", label: "Mulai", type: "text", placeholder: "2026-04-06 08:00" },
      { key: "content", label: "Konten", type: "textarea", placeholder: "Maintenance singkat pukul 01:00 WIB." },
    ],
  },
};

const platformConfigModules: Partial<
  Record<
    AdminSectionId,
    {
      configType: string;
      title: string;
      description: string;
      fields: Array<{ key: string; label: string; type: "text" | "number" | "textarea"; placeholder?: string }>;
    }
  >
> = {
  "manual-confirmation": {
    configType: "manual-confirmation",
    title: "Manual Confirmation",
    description: "Atur prosedur verifikasi manual pembayaran atau approval internal.",
    fields: [
      { key: "enabled", label: "Aktif", type: "text", placeholder: "true" },
      { key: "review_window_hours", label: "SLA review (jam)", type: "number", placeholder: "6" },
      { key: "notes", label: "Catatan", type: "textarea", placeholder: "Gunakan untuk invoice yang perlu verifikasi manual." },
    ],
  },
  "access-control": {
    configType: "access-control",
    title: "Access Control",
    description: "Atur policy akses internal super admin dan tim support.",
    fields: [
      { key: "allow_impersonation", label: "Impersonation", type: "text", placeholder: "false" },
      { key: "require_2fa", label: "Wajib 2FA", type: "text", placeholder: "true" },
      { key: "notes", label: "Policy", type: "textarea", placeholder: "Akses support dibatasi hari kerja." },
    ],
  },
  "wa-health": {
    configType: "wa-health",
    title: "WhatsApp Session Health",
    description: "Threshold dan policy monitoring untuk koneksi WA tenant.",
    fields: [
      { key: "max_retries", label: "Max retry", type: "number", placeholder: "3" },
      { key: "alert_channel", label: "Alert channel", type: "text", placeholder: "telegram-admin" },
      { key: "notes", label: "Catatan", type: "textarea", placeholder: "Alert jika 5 sesi disconnect." },
    ],
  },
  "security-settings": {
    configType: "security-settings",
    title: "Security Settings",
    description: "Kebijakan hardening platform yang bisa dikonfigurasi tanpa ubah kode.",
    fields: [
      { key: "login_rate_limit", label: "Login limit", type: "number", placeholder: "10" },
      { key: "session_hours", label: "Durasi sesi", type: "number", placeholder: "24" },
      { key: "notes", label: "Catatan", type: "textarea", placeholder: "Terapkan rotasi credential setiap 90 hari." },
    ],
  },
  maintenance: {
    configType: "maintenance",
    title: "Maintenance Mode",
    description: "Atur maintenance window dan pesan maintenance untuk tenant.",
    fields: [
      { key: "enabled", label: "Aktif", type: "text", placeholder: "false" },
      { key: "start_at", label: "Mulai", type: "text", placeholder: "2026-04-06 01:00" },
      { key: "message", label: "Pesan", type: "textarea", placeholder: "Platform akan maintenance 30 menit." },
    ],
  },
};

export function AdminSectionContent({
  section,
  data,
  focusTenantID,
}: {
  section: AdminSectionId;
  data: PlatformDataset;
  focusTenantID?: string;
}) {
  const orderedTenants = sortTenantsByFocus(data.tenants.tenants, focusTenantID);
  const latestTenants = orderedTenants.slice(0, 10);
  const paidTenants = orderedTenants.filter((tenant) => tenant.plan_code !== "free");
  const blockedTenants = orderedTenants.filter((tenant) => tenant.status !== "active");

  switch (section) {
    case "overview":
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow="Platform overview"
            title="Ikhtisar Internal Super Admin"
            description="Ringkasan tenant, pertumbuhan penggunaan, kesehatan sistem, dan audit terbaru BARBERA."
          />
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="Total Tenant Aktif" value={String(data.overview.stats.total_tenants)} desc={`${data.overview.stats.paid_tenants} berbayar • ${data.overview.stats.free_tenants} free`} />
            <MetricCard label="MRR Platform" value={formatIDR(data.overview.stats.estimated_mrr_idr)} desc="Estimasi dari paket tenant aktif" />
            <MetricCard label="Total Outlet" value={String(data.overview.stats.total_outlets)} desc="Cabang yang sudah terdaftar di seluruh tenant" />
            <MetricCard label="Total Visits 30 Hari" value={String(data.overview.stats.total_visits_30d)} desc={`${data.overview.stats.total_customers} total customer tenant`} />
          </section>
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card title="Tenant aktif terbaru" eyebrow="Tenant performance">
              <TenantsTable data={latestTenants} compact focusTenantID={focusTenantID} actionMode="overview" />
            </Card>
            <Card title="Kesehatan sistem" eyebrow="Operations">
              <div className="space-y-3 text-sm text-zinc-300">
                <div className="flex justify-between"><span>Database</span><span className="uppercase">{data.systemStatus.database}</span></div>
                <div className="flex justify-between"><span>Queue waiting</span><span>{data.systemStatus.total_queue_waiting}</span></div>
                <div className="flex justify-between"><span>Queue serving</span><span>{data.systemStatus.total_queue_serving}</span></div>
                <div className="flex justify-between"><span>Barbers on shift</span><span>{data.systemStatus.barbers_on_shift}</span></div>
                <div className="flex justify-between"><span>Active stations</span><span>{data.systemStatus.active_stations}</span></div>
              </div>
            </Card>
            <Card title="Audit logs terbaru" eyebrow="Security">
              <AuditLogList logs={data.auditLogs.audit_logs.slice(0, 8)} />
            </Card>
          </section>
        </div>
      );

    case "tenants":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Tenant management" title="Daftar Tenant" description="Kelola tenant aktif, paket, penggunaan, dan identitas public queue dari seluruh pelanggan BARBERA." />
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label="Total tenant" value={String(data.tenants.tenants.length)} desc="Seluruh tenant terdaftar" />
            <MetricCard label="Tenant free" value={String(data.overview.stats.free_tenants)} desc="Masih menggunakan paket gratis" />
            <MetricCard label="Tenant berbayar" value={String(data.overview.stats.paid_tenants)} desc="Sudah masuk paket monetisasi" />
            <MetricCard label="Total outlet" value={String(data.overview.stats.total_outlets)} desc="Cabang yang sudah aktif di platform" />
          </section>
          <Card title="Semua tenant aktif" eyebrow="Platform">
            <TenantsTable data={orderedTenants} focusTenantID={focusTenantID} />
          </Card>
        </div>
      );

    case "tenant-detail":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Tenant detail" title="Profil Tenant" description="Tampilan detail tenant untuk memeriksa slug, public queue, volume kunjungan, dan kapasitas operasional." />
          <Card title="Tenant profile roster" eyebrow="Identity & lifecycle">
            <TenantLifecycleTable data={orderedTenants.slice(0, 18)} focusTenantID={focusTenantID} />
          </Card>
        </div>
      );

    case "tenant-override":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Tenant override" title="Override Paket Tenant" description="Halaman ini dipakai untuk mengecek tenant yang nanti akan menerima limit, harga, atau fitur khusus di luar paket standar." />
          <TenantPlanManager
            tenants={orderedTenants}
            plans={data.plans.plans}
            title="Override plan tenant"
            description="Gunakan halaman ini untuk upgrade, downgrade, atau memindahkan tenant ke paket tertentu dari panel internal."
            focusTenantID={focusTenantID}
          />
        </div>
      );

    case "suspension":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Tenant control" title="Suspension / Reactivation" description="Pantau tenant yang aktif, bermasalah, atau nanti perlu disuspend untuk abuse, tunggakan, atau pelanggaran operasional." />
          <TenantStatusManager
            tenants={orderedTenants}
            title="Kontrol status tenant"
            description="Ubah status tenant langsung dari panel internal. Setiap perubahan status akan dicatat ke audit log platform."
            focusTenantID={focusTenantID}
          />
        </div>
      );

    case "plans":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Plans" title="Manajemen Paket" description="Lihat struktur paket Free, Pro, dan Plus beserta limit inti yang akan dijual ke tenant." />
          <PlanManagementPanel plans={data.plans.plans} />
        </div>
      );

    case "pricing":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Pricing" title="Pricing BARBERA" description="Fokus ke harga, positioning, dan diferensiasi paket yang sedang berjalan di platform." />
          <PlanManagementPanel plans={data.plans.plans} />
        </div>
      );

    case "subscriptions":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Subscriptions" title="Langganan Tenant" description="Pantau distribusi tenant free vs berbayar dan paket yang paling banyak dipakai." />
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label="Tenant free" value={String(data.overview.stats.free_tenants)} desc="Masih di free plan" />
            <MetricCard label="Tenant berbayar" value={String(data.overview.stats.paid_tenants)} desc="Sudah upgrade" />
            <MetricCard label="MRR estimasi" value={formatIDR(data.overview.stats.estimated_mrr_idr)} desc="Dari paket aktif" />
          </section>
          <TenantPlanManager
            tenants={orderedTenants}
            plans={data.plans.plans}
            title="Kelola langganan tenant"
            description="Pilih paket aktif tenant dan simpan perubahan langsung dari halaman subscriptions."
            focusTenantID={focusTenantID}
          />
        </div>
      );

    case "payments":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Payments" title="Monitoring Pembayaran Paket" description="Pantau order pembelian paket tenant, penggunaan coupon, dan transaksi yang menunggu konfirmasi super admin." />
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label="MRR" value={formatIDR(data.overview.stats.estimated_mrr_idr)} desc="Pendapatan berulang saat ini" />
            <MetricCard label="Order pending" value={String(data.billingOrders.orders.filter((item) => item.status === "pending_payment").length)} desc="Belum dibayar / belum kirim bukti" />
            <MetricCard label="Order menunggu review" value={String(data.billingOrders.orders.filter((item) => item.status === "waiting_confirmation").length)} desc="Siap dicek super admin" />
          </section>
          <Card title="Order pembelian paket" eyebrow="Collections">
            <BillingOrdersTable orders={data.billingOrders.orders} focusTenantID={focusTenantID} />
          </Card>
        </div>
      );

    case "invoices":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Invoices" title="Invoice Pembelian Paket" description="Ringkasan order pembelian paket yang dapat dipakai sebagai dasar invoice atau rekap tagihan tenant." />
          <Card title="Daftar invoice/order paket" eyebrow="Commercial">
            <BillingOrdersTable orders={data.billingOrders.orders} focusTenantID={focusTenantID} />
          </Card>
        </div>
      );

    case "manual-confirmation":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Manual confirmation" title="Konfirmasi Manual Paket" description="Tinjau order pembelian paket yang memakai QRIS manual atau coupon, lalu ubah statusnya dari panel internal." />
          <PlatformConfigManager
            configType="manual-qris-payment"
            title="Konfigurasi QRIS DANA Pribadi"
            description="Atur label QRIS, nama pemilik, secret Android forwarder, rentang nominal unik, dan batas waktu pencocokan otomatis."
            fields={[
              { key: "wallet_provider", label: "Provider wallet", type: "text", placeholder: "DANA" },
              { key: "wallet_account", label: "Nomor akun / catatan", type: "text", placeholder: "08xxxxxxxxxx" },
              { key: "qris_label", label: "Label QRIS", type: "text", placeholder: "QRIS DANA Pribadi" },
              { key: "qris_owner_name", label: "Nama pemilik QRIS", type: "text", placeholder: "Nama Anda" },
              { key: "qris_payload", label: "Raw string QRIS", type: "textarea", placeholder: "000201010211..." },
              { key: "qris_image_url", label: "URL gambar QRIS", type: "text", placeholder: "https://..." },
              { key: "forwarder_secret", label: "Secret Android forwarder", type: "text", placeholder: "barbera-secret" },
              { key: "payment_window_minutes", label: "Batas bayar (menit)", type: "number", placeholder: "30" },
              { key: "match_grace_minutes", label: "Grace cocok (menit)", type: "number", placeholder: "10" },
              { key: "unique_code_min", label: "Kode unik minimum", type: "number", placeholder: "1" },
              { key: "unique_code_max", label: "Kode unik maksimum", type: "number", placeholder: "499" },
            ]}
          />
          <Card title="Order yang perlu review" eyebrow="Approval">
            <BillingOrderStatusManager initialOrders={data.billingOrders.orders.filter((item) => item.status !== "paid")} focusTenantID={focusTenantID} />
          </Card>
        </div>
      );

    case "coupons": {
      const couponModule = platformResourceModules.coupons;
      const couponOrders = data.billingOrders.orders.filter((item) => item.coupon_code);
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Coupons" title="Coupon & Promo Platform" description="Kelola kupon BARBERA dan pantau order pembelian paket yang benar-benar memakai kupon tersebut." />
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label="Order pakai coupon" value={String(couponOrders.length)} desc="Sudah tercatat di billing order" />
            <MetricCard label="Pending + review" value={String(couponOrders.filter((item) => item.status !== "paid").length)} desc="Masih menunggu approval / pembayaran" />
            <MetricCard label="Paid with coupon" value={String(couponOrders.filter((item) => item.status === "paid").length)} desc="Sudah aktif ke tenant" />
          </section>
          {couponModule ? (
            <PlatformResourceManager
              resourceType={couponModule.resourceType}
              title={couponModule.title}
              description={couponModule.description}
              fields={couponModule.fields}
            />
          ) : null}
          <Card title="Riwayat penggunaan coupon" eyebrow="Commercial">
            <BillingOrdersTable orders={couponOrders} focusTenantID={focusTenantID} />
          </Card>
        </div>
      );
    }

    case "usage-metering":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Usage metering" title="Penggunaan Platform" description="Pantau total customer, visits, queue, dan kapasitas aktif untuk menilai beban platform per tenant." />
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="Total customer" value={String(data.overview.stats.total_customers)} desc="Akumulasi seluruh tenant" />
            <MetricCard label="Visits 30 hari" value={String(data.overview.stats.total_visits_30d)} desc="Volume transaksi terbaru" />
            <MetricCard label="Queue waiting" value={String(data.systemStatus.total_queue_waiting)} desc="Antrean aktif lintas tenant" />
            <MetricCard label="Active stations" value={String(data.systemStatus.active_stations)} desc="Station yang currently aktif" />
          </section>
          <Card title="Tenant usage snapshot" eyebrow="Control">
            <TenantsTable data={orderedTenants} focusTenantID={focusTenantID} />
          </Card>
        </div>
      );

    case "quota-limits":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Quota" title="Quota & Limits" description="Halaman batas penggunaan yang dipakai untuk membandingkan limit plan dengan kebutuhan tenant." />
          <PlansGrid plans={data.plans.plans} />
        </div>
      );

    case "system-status":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Operations" title="Kesehatan Sistem" description="Pantau database, antrean aktif, barber on shift, dan kapasitas station yang sedang berjalan." />
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <MetricCard label="Database" value={data.systemStatus.database.toUpperCase()} desc="Status koneksi backend" />
            <MetricCard label="Queue waiting" value={String(data.systemStatus.total_queue_waiting)} desc="Antrean menunggu" />
            <MetricCard label="Queue serving" value={String(data.systemStatus.total_queue_serving)} desc="Sedang dilayani" />
            <MetricCard label="Active stations" value={String(data.systemStatus.active_stations)} desc="Station yang aktif" />
            <MetricCard label="Barber on shift" value={String(data.systemStatus.barbers_on_shift)} desc="Barber yang sedang jadwal" />
          </section>
          <Card title="Audit operasional terbaru" eyebrow="Trace">
            <AuditLogList logs={data.auditLogs.audit_logs.slice(0, 12)} />
          </Card>
        </div>
      );

    case "audit-logs":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Security" title="Audit Logs" description="Jejak aktivitas tenant dan sistem untuk kebutuhan audit operasional, support, dan investigasi." />
          <Card title="50 log terbaru" eyebrow="Security trail">
            <AuditLogList logs={data.auditLogs.audit_logs} />
          </Card>
        </div>
      );

    case "blocked-tenants":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Security" title="Blocked Tenants" description="Daftar tenant yang diblokir atau tidak aktif karena kebijakan platform." />
          {blockedTenants.length > 0 ? (
            <Card title="Tenant non-aktif" eyebrow="Enforcement">
              <TenantsTable data={blockedTenants} compact focusTenantID={focusTenantID} />
            </Card>
          ) : (
            <EmptyModule title="Tidak ada tenant yang diblokir" description="Saat ini seluruh tenant masih aktif. Halaman ini siap dipakai saat mekanisme block/suspend final sudah disambungkan." checklist={["Riwayat alasan blokir", "Tanggal suspend dan restore", "Catatan tim support", "Integrasi ke audit log platform"]} />
          )}
        </div>
      );

    case "login-activity":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Security" title="Login Activity" description="Area monitoring aktivitas masuk super admin dan event akses penting lainnya." />
          <Card title="Jejak aktivitas terbaru" eyebrow="Authentication">
            <AuditLogList logs={data.auditLogs.audit_logs.slice(0, 20)} />
          </Card>
        </div>
      );

    default: {
      const resourceModule = platformResourceModules[section];
      if (resourceModule) {
        return (
          <div className="space-y-6">
            <PageHeader
              eyebrow="Platform module"
              title={resourceModule.title}
              description={resourceModule.description}
            />
            <PlatformResourceManager
              resourceType={resourceModule.resourceType}
              title={resourceModule.title}
              description={resourceModule.description}
              fields={resourceModule.fields}
            />
          </div>
        );
      }

      const configModule = platformConfigModules[section];
      if (configModule) {
        return (
          <div className="space-y-6">
            <PageHeader
              eyebrow="Platform config"
              title={configModule.title}
              description={configModule.description}
            />
            <PlatformConfigManager
              configType={configModule.configType}
              title={configModule.title}
              description={configModule.description}
              fields={configModule.fields}
            />
          </div>
        );
      }

      return (
        <EmptyModule
          title="Modul BARBERA"
          description="Halaman ini sudah menjadi route terpisah. Tinggal sambungan API spesifik bila modul baru dibutuhkan."
          checklist={[
            "Route menu sudah terpisah",
            "Siap disambungkan ke API tulis",
            "Bisa diberi role-based permission",
            "Audit log siap ditambahkan per aksi",
          ]}
        />
      );
    }
  }
}
