"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { TenantBillingModule } from "./tenant-billing-module";
import { TenantConfigModule } from "./tenant-config-module";
import { TenantPermissionsModule } from "./tenant-permissions-module";
import { TenantPageFrame } from "./tenant-page-frame";
import { TenantRolesModule } from "./tenant-roles-module";
import { formatDate, formatIDR } from "./tenant-utils";
import { useTenantSession } from "./use-tenant-session";

export type DynamicSectionId =
  | "services"
  | "payments-history"
  | "invoices"
  | "reminder-rules"
  | "reminder-queue"
  | "campaigns"
  | "loyalty"
  | "segments"
  | "dormant"
  | "templates"
  | "inbox"
  | "broadcast"
  | "daily-report"
  | "repeat-customer"
  | "retention-report"
  | "revenue"
  | "barber-performance"
  | "roles"
  | "permissions"
  | "billing"
  | "usage"
  | "integrations"
  | "audit"
  | "settings"
  | "help"
  | "changelog";

type ResourceItem = {
  id: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type CustomerRecord = {
  id: string;
  full_name: string;
  phone_number: string;
  preferred_barber_name?: string;
  preferred_barber?: string;
  notes: string;
  total_visits: number;
  total_spent_idr: number;
  last_visit_at?: string;
};

type VisitRecord = {
  id: string;
  customer_name: string;
  phone_number: string;
  service_name: string;
  barber_name: string;
  station_name?: string;
  amount_idr: number;
  payment_status: string;
  notes: string;
  visit_at: string;
  next_reminder_at?: string;
};

type DashboardSummary = {
  stats: {
    total_customers: number;
    active_customers_30d: number;
    dormant_customers_30d: number;
    visits_30d: number;
    revenue_30d_idr: number;
    average_ticket_30d_idr: number;
    upcoming_reminders_7d: number;
    barbers_on_shift_now: number;
    active_queue_tickets: number;
    active_stations: number;
  };
};

type BillingSummary = {
  plan_code: string;
  plan_name: string;
  monthly_price_idr: number;
  yearly_price_idr: number;
  billing_cycle_days: number;
  current_period_end?: string;
  max_outlets: number;
  max_users: number;
  max_customers: number;
  max_reminders_per_month: number;
  allow_campaigns: boolean;
  allow_loyalty: boolean;
  allow_multi_outlet: boolean;
};

type UsageSummary = {
  outlets: number;
  customers: number;
  visits_30d: number;
  queue_waiting: number;
  barbers: number;
  stations: number;
  max_outlets: number;
  max_customers: number;
  max_reminders_per_month: number;
};

type AuditLog = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  created_at: string;
};

type BarberRecord = {
  id: string;
  full_name: string;
  phone_number: string;
  on_shift?: boolean;
};

type AccessAccount = {
  id: string;
  barber_id: string;
  barber_name: string;
  access_code: string;
  status: string;
  last_login_at?: string;
};

type FieldSchema = {
  key: string;
  label: string;
  type: "text" | "number" | "textarea";
  placeholder?: string;
};

const SECTION_META: Record<DynamicSectionId, { title: string; description: string }> = {
  services: { title: "Layanan", description: "Kelola daftar layanan, durasi, dan harga dasar tenant." },
  "payments-history": { title: "Riwayat Pembayaran", description: "Lihat transaksi berstatus paid dari kunjungan tenant." },
  invoices: { title: "Invoice", description: "Tampilan invoice sederhana dari kunjungan dan nominal transaksi." },
  "reminder-rules": { title: "Reminder Rules", description: "Atur rule reminder follow-up pelanggan." },
  "reminder-queue": { title: "Reminder Queue", description: "Daftar kunjungan yang memiliki reminder berikutnya." },
  campaigns: { title: "Campaigns", description: "Kelola campaign win-back dan promosi pelanggan." },
  loyalty: { title: "Loyalty & Membership", description: "Atur loyalty dasar tenant Anda." },
  segments: { title: "Segmen Pelanggan", description: "Lihat segmentasi pelanggan dari histori kunjungan." },
  dormant: { title: "Pelanggan Tidur", description: "Daftar pelanggan yang belum kembali dalam 30 hari terakhir." },
  templates: { title: "Template Pesan", description: "Simpan template pesan reminder dan follow-up." },
  inbox: { title: "Inbox / Balasan", description: "Aktivitas command dan audit tenant terkait komunikasi." },
  broadcast: { title: "Broadcast History", description: "Riwayat campaign yang siap dipakai broadcast." },
  "daily-report": { title: "Laporan Harian", description: "Ringkasan performa harian tenant." },
  "repeat-customer": { title: "Repeat Customer", description: "Pantau pelanggan repeat terbaik tenant." },
  "retention-report": { title: "Retention", description: "Lihat tingkat pelanggan aktif dan dormant." },
  revenue: { title: "Omzet", description: "Analitik omzet dari data kunjungan tenant." },
  "barber-performance": { title: "Performa Barber", description: "Bandingkan barber berdasarkan layanan dan omzet." },
  roles: { title: "Tim & Role", description: "Lihat owner dan barber yang aktif beserta akses POS." },
  permissions: { title: "Permission", description: "Matriks hak akses per role tenant." },
  billing: { title: "Billing & Subscription", description: "Ringkasan paket aktif, harga, durasi, dan limit." },
  usage: { title: "Usage & Limits", description: "Bandingkan penggunaan tenant dengan limit paket." },
  integrations: { title: "Integrations", description: "Simpan pengaturan integrasi dasar tenant." },
  audit: { title: "Audit Log", description: "Jejak aktivitas terbaru pada tenant Anda." },
  settings: { title: "Settings", description: "Konfigurasi dasar tenant seperti pesan sambutan." },
  help: { title: "Bantuan", description: "Panduan cepat penggunaan BARBERA." },
  changelog: { title: "Changelog", description: "Catatan perubahan fitur pada workspace tenant." },
};

const RESOURCE_SECTIONS: Partial<Record<DynamicSectionId, { resourceType: string; fields: FieldSchema[] }>> = {
  services: {
    resourceType: "service",
    fields: [
      { key: "base_price_idr", label: "Harga dasar", type: "number", placeholder: "65000" },
      { key: "duration_minutes", label: "Durasi (menit)", type: "number", placeholder: "45" },
      { key: "description", label: "Deskripsi", type: "textarea", placeholder: "Potong rambut premium." },
    ],
  },
  "reminder-rules": {
    resourceType: "reminder_rule",
    fields: [
      { key: "days_after_visit", label: "Hari setelah kunjungan", type: "number", placeholder: "21" },
      { key: "channel", label: "Channel", type: "text", placeholder: "whatsapp" },
      { key: "message", label: "Template pesan", type: "textarea", placeholder: "Halo {{name}}, sudah waktunya pangkas lagi." },
    ],
  },
  campaigns: {
    resourceType: "campaign",
    fields: [
      { key: "audience", label: "Target audience", type: "text", placeholder: "dormant_30d" },
      { key: "offer", label: "Penawaran", type: "text", placeholder: "Diskon 10% weekday" },
      { key: "message", label: "Pesan campaign", type: "textarea", placeholder: "Balik cukur minggu ini dan dapat promo." },
    ],
  },
  templates: {
    resourceType: "message_template",
    fields: [
      { key: "channel", label: "Channel", type: "text", placeholder: "whatsapp" },
      { key: "purpose", label: "Tujuan", type: "text", placeholder: "reminder" },
      { key: "content", label: "Isi template", type: "textarea", placeholder: "Halo {{name}}, barber favorit Anda siap." },
    ],
  },
};

const CONFIG_SECTIONS: Partial<Record<DynamicSectionId, { configType: string; fields: FieldSchema[] }>> = {
  loyalty: {
    configType: "loyalty",
    fields: [
      { key: "enabled", label: "Aktif (true/false)", type: "text", placeholder: "true" },
      { key: "visit_target", label: "Target kunjungan", type: "number", placeholder: "5" },
      { key: "reward_label", label: "Reward", type: "text", placeholder: "Gratis 1 kali potong" },
      { key: "points_per_visit", label: "Poin per kunjungan", type: "number", placeholder: "10" },
    ],
  },
};

const dynamicSectionSet = new Set<DynamicSectionId>([
  "services",
  "payments-history",
  "invoices",
  "reminder-rules",
  "reminder-queue",
  "campaigns",
  "loyalty",
  "segments",
  "dormant",
  "templates",
  "inbox",
  "broadcast",
  "daily-report",
  "repeat-customer",
  "retention-report",
  "revenue",
  "barber-performance",
  "roles",
  "permissions",
  "billing",
  "usage",
  "integrations",
  "audit",
  "settings",
  "help",
  "changelog",
]);

const PREMIUM_SECTION_REQUIREMENTS: Partial<
  Record<DynamicSectionId, { key: keyof BillingSummary; title: string; description: string }>
> = {
  campaigns: {
    key: "allow_campaigns",
    title: "Campaigns terkunci di paket ini",
    description: "Upgrade ke Pro atau Plus untuk memakai campaign win-back dan retensi pelanggan.",
  },
  loyalty: {
    key: "allow_loyalty",
    title: "Loyalty & Membership belum aktif",
    description: "Upgrade paket agar poin, stamp, dan membership pelanggan dapat dipakai penuh.",
  },
};

export function isDynamicSectionId(value: string): value is DynamicSectionId {
  return dynamicSectionSet.has(value as DynamicSectionId);
}

function parseFieldValue(field: FieldSchema, value: string) {
  if (field.type === "number") {
    return Number(value || 0);
  }
  return value;
}

function getDaysSince(value?: string) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const diff = Date.now() - new Date(value).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function groupVisitsByBarber(visits: VisitRecord[]) {
  const result = new Map<string, { visits: number; revenue: number }>();

  for (const visit of visits) {
    const key = visit.barber_name || "Belum dipilih";
    const current = result.get(key) ?? { visits: 0, revenue: 0 };
    current.visits += 1;
    current.revenue += visit.amount_idr;
    result.set(key, current);
  }

  return [...result.entries()]
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((left, right) => right.revenue - left.revenue || right.visits - left.visits);
}

export function TenantDynamicPageClient({ section }: { section: DynamicSectionId }) {
  const session = useTenantSession();
  const meta = SECTION_META[section];
  const resourceConfig = RESOURCE_SECTIONS[section];
  const configSection = CONFIG_SECTIONS[section];
  const premiumGate = PREMIUM_SECTION_REQUIREMENTS[section];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingID, setEditingID] = useState("");
  const [resourceItems, setResourceItems] = useState<ResourceItem[]>([]);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [resourceForm, setResourceForm] = useState<Record<string, string>>({ name: "", status: "active" });
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [barbers, setBarbers] = useState<BarberRecord[]>([]);
  const [accessAccounts, setAccessAccounts] = useState<AccessAccount[]>([]);

  useEffect(() => {
    if (!resourceConfig) {
      return;
    }

    setResourceForm(
      Object.fromEntries([["name", ""], ["status", "active"], ...resourceConfig.fields.map((field) => [field.key, ""])]),
    );
  }, [resourceConfig]);

  useEffect(() => {
    if (!configSection) {
      return;
    }

    setConfigValues(Object.fromEntries(configSection.fields.map((field) => [field.key, ""])));
  }, [configSection]);

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    void (async () => {
      try {
        setLoading(true);
        setError("");

        if (premiumGate) {
          const billingPayload = await apiRequest<BillingSummary>("/api/v1/billing/summary", {
            token: session.access_token,
          });
          setBilling(billingPayload);
          if (!Boolean(billingPayload[premiumGate.key] as boolean | undefined)) {
            return;
          }
        }

        if (resourceConfig) {
          const payload = await apiRequest<{ items: ResourceItem[] }>(
            `/api/v1/resources/${resourceConfig.resourceType}`,
            { token: session.access_token },
          );
          setResourceItems(payload.items ?? []);
        } else if (configSection) {
          const payload = await apiRequest<{ config: Record<string, unknown> }>(
            `/api/v1/config/${configSection.configType}`,
            { token: session.access_token },
          );
          setConfigValues(
            Object.fromEntries(
              configSection.fields.map((field) => [field.key, String(payload.config?.[field.key] ?? "")]),
            ),
          );
        } else {
          switch (section) {
            case "payments-history":
            case "invoices":
            case "reminder-queue":
            case "revenue": {
              const payload = await apiRequest<{ visits: VisitRecord[] }>("/api/v1/visits", {
                token: session.access_token,
              });
              setVisits(payload.visits ?? []);
              break;
            }
            case "segments":
            case "dormant":
            case "repeat-customer": {
              const payload = await apiRequest<{ customers: CustomerRecord[] }>("/api/v1/customers", {
                token: session.access_token,
              });
              setCustomers(payload.customers ?? []);
              break;
            }
            case "daily-report":
            case "retention-report":
            case "barber-performance": {
              const [summaryPayload, visitPayload] = await Promise.all([
                apiRequest<DashboardSummary>("/api/v1/dashboard/summary", {
                  token: session.access_token,
                }),
                apiRequest<{ visits: VisitRecord[] }>("/api/v1/visits", {
                  token: session.access_token,
                }),
              ]);
              setSummary(summaryPayload);
              setVisits(visitPayload.visits ?? []);
              break;
            }
            case "billing": {
              break;
            }
            case "roles":
            case "permissions":
            case "settings":
            case "integrations": {
              const payload = await apiRequest<BillingSummary>("/api/v1/billing/summary", {
                token: session.access_token,
              });
              setBilling(payload);
              break;
            }
            case "usage": {
              const payload = await apiRequest<UsageSummary>("/api/v1/usage/summary", {
                token: session.access_token,
              });
              setUsage(payload);
              break;
            }
            case "audit":
            case "inbox":
            case "broadcast": {
              const payload = await apiRequest<{ audit_logs: AuditLog[] }>("/api/v1/audit-logs?limit=50", {
                token: session.access_token,
              });
              setAuditLogs(payload.audit_logs ?? []);
              break;
            }
          }
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Gagal memuat halaman.");
      } finally {
        setLoading(false);
      }
    })();
  }, [configSection, resourceConfig, section, session?.access_token]);

  async function handleResourceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token || !resourceConfig) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const payload = await apiRequest<ResourceItem>(
        editingID
          ? `/api/v1/resources/${resourceConfig.resourceType}/${editingID}`
          : `/api/v1/resources/${resourceConfig.resourceType}`,
        {
          method: editingID ? "PUT" : "POST",
          token: session.access_token,
          body: {
            name: resourceForm.name,
            status: resourceForm.status,
            config: Object.fromEntries(
              resourceConfig.fields.map((field) => [field.key, parseFieldValue(field, resourceForm[field.key] ?? "")]),
            ),
          },
        },
      );

      setMessage(editingID ? "Perubahan berhasil disimpan." : "Item baru berhasil ditambahkan.");
      setEditingID("");
      setResourceForm(
        Object.fromEntries([["name", ""], ["status", "active"], ...resourceConfig.fields.map((field) => [field.key, ""])]),
      );
      setResourceItems((current) => (editingID ? current.map((item) => (item.id === payload.id ? payload : item)) : [payload, ...current]));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal menyimpan item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteResource(itemID: string) {
    if (!session?.access_token || !resourceConfig) {
      return;
    }

    try {
      setError("");
      await apiRequest<{ ok: boolean }>(`/api/v1/resources/${resourceConfig.resourceType}/${itemID}`, {
        method: "DELETE",
        token: session.access_token,
      });
      setResourceItems((current) => current.filter((item) => item.id !== itemID));
      setMessage("Item berhasil dihapus.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus item.");
    }
  }

  async function handleConfigSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token || !configSection) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiRequest<{ config: Record<string, unknown> }>(`/api/v1/config/${configSection.configType}`, {
        method: "PUT",
        token: session.access_token,
        body: {
          config: Object.fromEntries(
            configSection.fields.map((field) => [field.key, parseFieldValue(field, configValues[field.key] ?? "")]),
          ),
        },
      });
      setMessage("Konfigurasi berhasil disimpan.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  }

  const paidVisits = visits.filter((visit) => visit.payment_status === "paid");
  const reminderVisits = visits.filter((visit) => visit.next_reminder_at);
  const dormantCustomers = customers.filter((customer) => getDaysSince(customer.last_visit_at) >= 30);
  const repeatCustomers = [...customers].sort(
    (left, right) => right.total_visits - left.total_visits || right.total_spent_idr - left.total_spent_idr,
  );
  const barberSummary = groupVisitsByBarber(visits);
  const isPremiumLocked =
    premiumGate && billing ? !Boolean(billing[premiumGate.key] as boolean | undefined) : false;

  return (
    <TenantPageFrame session={session} active={section} title={meta.title} description={meta.description}>
      <div className="space-y-6">
        {loading ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Memuat data {meta.title.toLowerCase()}...
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
        ) : null}

        {isPremiumLocked && premiumGate ? (
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-amber-900">{premiumGate.title}</h2>
            <p className="mt-2 text-sm text-amber-800">{premiumGate.description}</p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-white/80 p-4 text-sm text-amber-900">
              Paket aktif: <strong>{billing?.plan_name ?? "Free"}</strong>. Buka menu{" "}
              <strong>Billing & Subscription</strong> untuk membuat order upgrade.
            </div>
          </article>
        ) : null}

        {resourceConfig && !isPremiumLocked ? (
          <section className="grid gap-6">
            {section === "templates" ? (
              <article className="rounded-2xl border border-[#F0EDE8] bg-[#FCFBFA] p-5 shadow-sm">
                <h2 className="text-lg font-bold text-[#1A1A1A]">Template siap pakai</h2>
                <p className="mt-2 text-sm text-[#6B6B6B]">
                  BARBERA menyiapkan template default supaya owner bisa langsung kirim link antrean, reminder cukur ulang,
                  win-back, dan minta review tanpa menulis dari nol.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {["{{name}}", "{{queue_link}}", "{{barbershop_name}}", "{{google_review_url}}"].map((tag) => (
                    <div key={tag} className="rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm font-semibold text-[#1A1A1A]">
                      {tag}
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {section === "reminder-rules" ? (
              <article className="rounded-2xl border border-[#F0EDE8] bg-[#FCFBFA] p-5 shadow-sm">
                <h2 className="text-lg font-bold text-[#1A1A1A]">Rule bawaan untuk mulai cepat</h2>
                <p className="mt-2 text-sm text-[#6B6B6B]">
                  Tenant baru otomatis mendapat reminder rule 21 hari. Anda cukup menyesuaikan interval atau pesan bila
                  memang dibutuhkan.
                </p>
              </article>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#1A1A1A]">{editingID ? "Edit item" : "Tambah item"}</h2>
              <form className="mt-4 space-y-4" onSubmit={handleResourceSubmit}>
                <input
                  required
                  value={resourceForm.name ?? ""}
                  onChange={(event) => setResourceForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                  placeholder="Nama item"
                />
                {resourceConfig.fields.map((field) =>
                  field.type === "textarea" ? (
                    <textarea
                      key={field.key}
                      value={resourceForm[field.key] ?? ""}
                      onChange={(event) => setResourceForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="min-h-28 w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      key={field.key}
                      type={field.type}
                      value={resourceForm[field.key] ?? ""}
                      onChange={(event) => setResourceForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                      placeholder={field.placeholder}
                    />
                  ),
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : editingID ? "Simpan perubahan" : "Tambah item"}
                </button>
              </form>
            </article>

            <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
              <div className="border-b border-[#F0EDE8] px-6 py-4">
                <h2 className="text-lg font-bold text-[#1A1A1A]">Daftar item</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
                    <tr>
                      <th className="px-4 py-3">Nama</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Konfigurasi</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && resourceItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-sm text-[#6B6B6B]">
                          Belum ada data.
                        </td>
                      </tr>
                    ) : null}
                    {resourceItems.map((item) => (
                      <tr key={item.id} className="border-t border-[#F0EDE8] align-top">
                        <td className="px-4 py-4 font-semibold text-[#1A1A1A]">{item.name}</td>
                        <td className="px-4 py-4 text-sm uppercase text-[#6B6B6B]">{item.status}</td>
                        <td className="px-4 py-4 text-xs text-[#6B6B6B]">
                          {resourceConfig.fields.map((field) => `${field.label}: ${String(item.config?.[field.key] ?? "-")}`).join(" • ")}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingID(item.id);
                                setResourceForm({
                                  name: item.name,
                                  status: item.status,
                                  ...Object.fromEntries(
                                    resourceConfig.fields.map((field) => [field.key, String(item.config?.[field.key] ?? "")]),
                                  ),
                                });
                              }}
                              className="rounded-lg border border-[#E5E5E5] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteResource(item.id)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            </div>
          </section>
        ) : null}

        {section === "billing" ? <TenantBillingModule /> : null}

        {section === "roles" ? <TenantRolesModule /> : null}

        {section === "settings" ? <TenantConfigModule kind="settings" /> : null}

        {section === "integrations" ? <TenantConfigModule kind="integrations" /> : null}

        {configSection && section !== "settings" && section !== "integrations" && !isPremiumLocked ? (
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Konfigurasi {meta.title}</h2>
            <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleConfigSave}>
              {configSection.fields.map((field) =>
                field.type === "textarea" ? (
                  <label key={field.key} className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-[#1A1A1A]">{field.label}</span>
                    <textarea
                      value={configValues[field.key] ?? ""}
                      onChange={(event) => setConfigValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="min-h-28 w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                      placeholder={field.placeholder}
                    />
                  </label>
                ) : (
                  <label key={field.key} className="space-y-2">
                    <span className="text-sm font-medium text-[#1A1A1A]">{field.label}</span>
                    <input
                      type={field.type}
                      value={configValues[field.key] ?? ""}
                      onChange={(event) => setConfigValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                      placeholder={field.placeholder}
                    />
                  </label>
                ),
              )}
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan konfigurasi"}
                </button>
              </div>
            </form>
          </article>
        ) : null}

        {section === "usage" && usage ? (
          <section className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Outlet", value: `${usage.outlets} / ${usage.max_outlets}` },
              { label: "Customer", value: `${usage.customers} / ${usage.max_customers}` },
              { label: "Visits 30 Hari", value: String(usage.visits_30d) },
              { label: "Queue waiting", value: String(usage.queue_waiting) },
              { label: "Barber aktif", value: String(usage.barbers) },
              { label: "Station aktif", value: String(usage.stations) },
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-[#F0EDE8] bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">{item.label}</p>
                <strong className="mt-2 block text-2xl font-extrabold text-[#1A1A1A]">{item.value}</strong>
              </article>
            ))}
          </section>
        ) : null}

        {(section === "payments-history" || section === "invoices" || section === "reminder-queue") ? (
          <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#F0EDE8] px-6 py-4">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Daftar transaksi</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
                  <tr>
                    <th className="px-4 py-3">Pelanggan</th>
                    <th className="px-4 py-3">Layanan</th>
                    <th className="px-4 py-3">Barber</th>
                    <th className="px-4 py-3">Jumlah</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {(section === "payments-history" ? paidVisits : section === "reminder-queue" ? reminderVisits : visits).map((visit) => (
                    <tr key={visit.id} className="border-t border-[#F0EDE8]">
                      <td className="px-4 py-4 font-semibold text-[#1A1A1A]">{visit.customer_name}</td>
                      <td className="px-4 py-4 text-sm text-[#6B6B6B]">{visit.service_name}</td>
                      <td className="px-4 py-4 text-sm text-[#6B6B6B]">{visit.barber_name || "-"}</td>
                      <td className="px-4 py-4 text-sm text-[#1A1A1A]">{formatIDR(visit.amount_idr)}</td>
                      <td className="px-4 py-4 text-sm uppercase text-[#6B6B6B]">{visit.payment_status}</td>
                      <td className="px-4 py-4 text-sm text-[#6B6B6B]">
                        {section === "reminder-queue" ? formatDate(visit.next_reminder_at) : formatDate(visit.visit_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ) : null}

        {(section === "segments" || section === "dormant" || section === "repeat-customer") ? (
          <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#F0EDE8] px-6 py-4">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Pelanggan</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
                  <tr>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">Telepon</th>
                    <th className="px-4 py-3">Barber favorit</th>
                    <th className="px-4 py-3">Visits</th>
                    <th className="px-4 py-3">Spend</th>
                    <th className="px-4 py-3">Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {(section === "dormant" ? dormantCustomers : repeatCustomers).map((customer) => {
                    const segment = customer.total_visits >= 4 ? "VIP" : customer.total_visits >= 2 ? "Repeat" : "Baru";
                    return (
                      <tr key={customer.id} className="border-t border-[#F0EDE8]">
                        <td className="px-4 py-4 font-semibold text-[#1A1A1A]">{customer.full_name}</td>
                        <td className="px-4 py-4 text-sm text-[#6B6B6B]">{customer.phone_number}</td>
                        <td className="px-4 py-4 text-sm text-[#6B6B6B]">
                          {customer.preferred_barber_name || customer.preferred_barber || "-"}
                        </td>
                        <td className="px-4 py-4 text-sm text-[#6B6B6B]">{customer.total_visits}</td>
                        <td className="px-4 py-4 text-sm text-[#1A1A1A]">{formatIDR(customer.total_spent_idr)}</td>
                        <td className="px-4 py-4 text-sm uppercase text-[#6B6B6B]">
                          {section === "dormant" ? `Dormant ${getDaysSince(customer.last_visit_at)} hari` : segment}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        ) : null}

        {(section === "daily-report" || section === "retention-report") && summary ? (
          <section className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Revenue 30D", value: formatIDR(summary.stats.revenue_30d_idr) },
              { label: "Visits 30D", value: String(summary.stats.visits_30d) },
              { label: "Dormant 30D", value: String(summary.stats.dormant_customers_30d) },
              { label: "Reminder 7D", value: String(summary.stats.upcoming_reminders_7d) },
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-[#F0EDE8] bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">{item.label}</p>
                <strong className="mt-2 block text-2xl font-extrabold text-[#1A1A1A]">{item.value}</strong>
              </article>
            ))}
          </section>
        ) : null}

        {section === "revenue" ? (
          <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#F0EDE8] px-6 py-4">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Ringkasan omzet kunjungan</h2>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-3">
              <article className="rounded-xl border border-[#F0EDE8] p-4">
                <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">Total paid</p>
                <strong className="mt-2 block text-2xl font-extrabold text-[#1A1A1A]">
                  {formatIDR(paidVisits.reduce((sum, item) => sum + item.amount_idr, 0))}
                </strong>
              </article>
              <article className="rounded-xl border border-[#F0EDE8] p-4">
                <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">Transaksi paid</p>
                <strong className="mt-2 block text-2xl font-extrabold text-[#1A1A1A]">{paidVisits.length}</strong>
              </article>
              <article className="rounded-xl border border-[#F0EDE8] p-4">
                <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">Rata-rata tiket</p>
                <strong className="mt-2 block text-2xl font-extrabold text-[#1A1A1A]">
                  {formatIDR(
                    paidVisits.length > 0
                      ? Math.round(paidVisits.reduce((sum, item) => sum + item.amount_idr, 0) / paidVisits.length)
                      : 0,
                  )}
                </strong>
              </article>
            </div>
          </article>
        ) : null}

        {section === "barber-performance" ? (
          <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#F0EDE8] px-6 py-4">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Performa barber</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
                  <tr>
                    <th className="px-4 py-3">Barber</th>
                    <th className="px-4 py-3">Visits</th>
                    <th className="px-4 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {barberSummary.map((item) => (
                    <tr key={item.name} className="border-t border-[#F0EDE8]">
                      <td className="px-4 py-4 font-semibold text-[#1A1A1A]">{item.name}</td>
                      <td className="px-4 py-4 text-sm text-[#6B6B6B]">{item.visits}</td>
                      <td className="px-4 py-4 text-sm text-[#1A1A1A]">{formatIDR(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ) : null}

        {section === "permissions" ? <TenantPermissionsModule /> : null}

        {(section === "audit" || section === "inbox" || section === "broadcast") ? (
          <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#F0EDE8] px-6 py-4">
              <h2 className="text-lg font-bold text-[#1A1A1A]">
                {section === "broadcast" ? "Riwayat aktivitas channel" : "Aktivitas terbaru"}
              </h2>
            </div>
            <div className="divide-y divide-[#F0EDE8]">
              {auditLogs.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-4 px-6 py-4">
                  <div>
                    <p className="font-semibold text-[#1A1A1A]">{entry.action}</p>
                    <p className="text-sm text-[#6B6B6B]">
                      {entry.target_type} • {entry.target_id}
                    </p>
                  </div>
                  <span className="text-xs text-[#A3A3A3]">{formatDate(entry.created_at)}</span>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        {(section === "help" || section === "changelog") ? (
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#1A1A1A]">{meta.title}</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#6B6B6B]">
              {section === "help" ? (
                <>
                  <p>1. Mulai dari data barber, station, dan shift agar alur antrian rapi.</p>
                  <p>2. Gunakan menu Layanan, Campaigns, dan Reminder Rules untuk mengatur workflow retensi.</p>
                  <p>3. Pantau Billing & Usage sebelum menambah outlet baru agar limit paket tetap aman.</p>
                </>
              ) : (
                <>
                  <p>v0.1: auth tenant, POS barber, public queue, dan super admin terpisah sudah aktif.</p>
                  <p>v0.2: outlet multi-branch, plan management, dan dynamic module tenant/admin tersambung.</p>
                  <p>v0.3: sinkronisasi harga landing page dan aksi panel internal sudah berjalan.</p>
                </>
              )}
            </div>
          </article>
        ) : null}
      </div>
    </TenantPageFrame>
  );
}
