"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { apiRequest } from "../lib/api";
import { formatDate, formatIDR } from "./tenant-utils";
import { useTenantSession } from "./use-tenant-session";

type BillingSummary = {
  plan_code: string;
  plan_name: string;
  is_free: boolean;
  monthly_price_idr: number;
  yearly_price_idr: number;
  billing_cycle_days: number;
  current_period_end?: string;
  max_outlets: number;
  max_users: number;
  max_customers: number;
  max_reminders_per_month: number;
  max_whatsapp_sessions: number;
  allow_campaigns: boolean;
  allow_loyalty: boolean;
  allow_exports: boolean;
  allow_multi_outlet: boolean;
};

type CatalogPlan = {
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
};

type BillingOrder = {
  id: string;
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
  unique_amount_idr: number;
  payment_amount_idr: number;
  payment_reference: string;
  payment_expires_at?: string;
  payment_channel: string;
  status: string;
  notes: string;
  metadata?: Record<string, unknown>;
  payment_confirm_source?: string;
  paid_amount_idr?: number;
  created_at: string;
  paid_at?: string;
};

function buildPlanFeatures(plan: CatalogPlan) {
  const features = [
    `${plan.max_outlets} outlet`,
    `${plan.max_users} user dashboard`,
    `${plan.max_customers} pelanggan`,
    `${plan.max_reminders_per_month} reminder / bulan`,
    `${plan.max_whatsapp_sessions} sesi WhatsApp`,
  ];
  if (plan.allow_campaigns) features.push("Campaign win-back");
  if (plan.allow_loyalty) features.push("Loyalty & membership");
  if (plan.allow_exports) features.push("Export laporan");
  if (plan.allow_multi_outlet) features.push("Multi-outlet aktif");
  return features;
}

export function TenantBillingModule() {
  const session = useTenantSession();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [plans, setPlans] = useState<CatalogPlan[]>([]);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [couponCode, setCouponCode] = useState("");
  const [notes, setNotes] = useState("");
  const [qrisDataURL, setQRISDataURL] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  async function loadData() {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      setError("");
      const [summaryPayload, plansPayload, ordersPayload] = await Promise.all([
        apiRequest<BillingSummary>("/api/v1/billing/summary", { token: session.access_token }),
        apiRequest<{ plans: CatalogPlan[] }>("/api/v1/billing/catalog"),
        apiRequest<{ orders: BillingOrder[] }>("/api/v1/billing/orders", { token: session.access_token }),
      ]);
      setSummary(summaryPayload);
      setPlans(plansPayload.plans ?? []);
      setOrders(ordersPayload.orders ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memuat billing tenant.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  useEffect(() => {
    const requestedPlan = searchParams.get("plan");
    const requestedCycle = searchParams.get("cycle");
    if (requestedPlan) {
      setSelectedPlan(requestedPlan);
    }
    if (requestedCycle === "yearly" || requestedCycle === "monthly") {
      setBillingCycle(requestedCycle);
    }
  }, [searchParams]);

  const selectedPlanDetail = useMemo(
    () => plans.find((plan) => plan.code === selectedPlan) ?? null,
    [plans, selectedPlan],
  );
  const latestPendingOrder = useMemo(
    () =>
      orders.find((order) => order.payment_channel === "manual_qris" && ["pending_payment", "waiting_confirmation"].includes(order.status)) ??
      null,
    [orders],
  );
  const paymentInstructions = useMemo(
    () => (latestPendingOrder?.metadata?.payment_instructions as Record<string, unknown> | undefined) ?? undefined,
    [latestPendingOrder],
  );
  const qrisPayload = typeof paymentInstructions?.qris_payload === "string" ? paymentInstructions.qris_payload : "";
  const qrisImageURL = typeof paymentInstructions?.qris_image_url === "string" ? paymentInstructions.qris_image_url : "";

  useEffect(() => {
    let active = true;
    async function generateQR() {
      if (!qrisPayload.trim()) {
        setQRISDataURL("");
        return;
      }

      try {
        const QRCode = await import("qrcode");
        const dataURL = await QRCode.toDataURL(qrisPayload, {
          margin: 1,
          width: 320,
          errorCorrectionLevel: "M",
        });
        if (active) {
          setQRISDataURL(dataURL);
        }
      } catch {
        if (active) {
          setQRISDataURL("");
        }
      }
    }

    void generateQR();
    return () => {
      active = false;
    };
  }, [qrisPayload]);

  async function handleCreateOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;
    try {
      setSubmitting(true);
      setError("");
      setMessage("");
      const order = await apiRequest<BillingOrder>("/api/v1/billing/orders", {
        method: "POST",
        token: session.access_token,
        body: {
          plan_code: selectedPlan,
          billing_cycle: billingCycle,
          coupon_code: couponCode,
          payment_channel: "manual_qris",
          notes,
        },
      });
      setOrders((current) => [order, ...current]);
      setCouponCode("");
      setNotes("");
      if (order.status === "paid") {
        setMessage("Paket berhasil diaktifkan.");
        await loadData();
      } else {
        setMessage("Order paket berhasil dibuat. Silakan bayar dengan nominal unik yang muncul di panel ini.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal membuat order paket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyQRIS() {
    if (!qrisPayload.trim()) return;
    try {
      await navigator.clipboard.writeText(qrisPayload);
      setCopyMessage("Raw string QRIS berhasil disalin.");
    } catch {
      setCopyMessage("Gagal menyalin raw string QRIS.");
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Memuat data billing tenant...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {copyMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {copyMessage}
        </div>
      ) : null}

      {summary ? (
        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Paket aktif</p>
            <strong className="mt-2 block text-2xl font-extrabold text-[#1A1A1A]">{summary.plan_name}</strong>
            <p className="mt-2 text-sm text-[#6B6B6B]">{summary.is_free ? "Gratis permanen" : formatIDR(summary.monthly_price_idr)}</p>
          </article>
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Periode aktif</p>
            <strong className="mt-2 block text-xl font-extrabold text-[#1A1A1A]">
              {summary.current_period_end ? formatDate(summary.current_period_end) : "Tidak dibatasi"}
            </strong>
          </article>
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Upgrade reason</p>
            <strong className="mt-2 block text-xl font-extrabold text-[#1A1A1A]">
              {summary.allow_campaigns ? "Retensi siap" : "Campaign masih terkunci"}
            </strong>
          </article>
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Limit outlet</p>
            <strong className="mt-2 block text-xl font-extrabold text-[#1A1A1A]">{summary.max_outlets}</strong>
          </article>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Beli atau upgrade paket</h2>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Pilih paket, durasi billing, lalu buat order agar muncul ke super admin untuk pembayaran atau approval.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleCreateOrder}>
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const active = selectedPlan === plan.code;
                return (
                  <button
                    key={plan.code}
                    type="button"
                    onClick={() => setSelectedPlan(plan.code)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active ? "border-[#C8A464] bg-[#FFF8EE]" : "border-[#F0EDE8] bg-[#FCFBFA]"
                    }`}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">{plan.code}</p>
                    <h3 className="mt-2 text-lg font-bold text-[#1A1A1A]">{plan.name}</h3>
                    <p className="mt-1 text-sm text-[#6B6B6B]">{plan.description}</p>
                    <p className="mt-3 text-sm font-semibold text-[#1A1A1A]">
                      {plan.is_free ? "Gratis permanen" : formatIDR(plan.monthly_price_idr)}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#1A1A1A]">Durasi billing</span>
                <select
                  value={billingCycle}
                  onChange={(event) => setBillingCycle(event.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3"
                >
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#1A1A1A]">Coupon</span>
                <input
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                  placeholder="BARBERA10"
                />
              </label>
            </div>
            <label className="space-y-2 block">
              <span className="text-sm font-medium text-[#1A1A1A]">Catatan order</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-24 w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Tambahkan catatan jika perlu verifikasi manual."
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !selectedPlanDetail}
              className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? "Membuat order..." : "Buat order pembelian paket"}
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Ringkasan paket dipilih</h2>
          {selectedPlanDetail ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">{selectedPlanDetail.name}</p>
                <p className="text-sm text-[#6B6B6B]">{selectedPlanDetail.description}</p>
              </div>
              <div className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Estimasi harga</p>
                <strong className="mt-2 block text-2xl font-extrabold text-[#1A1A1A]">
                  {selectedPlanDetail.is_free
                    ? "Gratis"
                    : billingCycle === "yearly"
                      ? formatIDR(selectedPlanDetail.yearly_price_idr || selectedPlanDetail.monthly_price_idr * 12)
                      : formatIDR(selectedPlanDetail.monthly_price_idr)}
                </strong>
              </div>
              <div className="space-y-2 text-sm text-[#6B6B6B]">
                {buildPlanFeatures(selectedPlanDetail).map((feature) => (
                  <div key={feature} className="rounded-xl border border-[#F0EDE8] px-3 py-2">
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </section>

      {latestPendingOrder ? (
        <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1A1A1A]">Instruksi pembayaran QRIS pribadi</h2>
              <p className="mt-1 text-sm text-[#6B6B6B]">
                Bayar tepat sesuai nominal unik agar sistem bisa mencocokkan pembayaran otomatis dari notifikasi HP Anda.
              </p>
            </div>
            <span className="rounded-full border border-[#F0EDE8] px-3 py-1 text-xs font-semibold uppercase text-[#6B6B6B]">
              {latestPendingOrder.status}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Nominal bayar</p>
              <strong className="mt-2 block text-2xl font-extrabold text-[#1A1A1A]">
                {formatIDR(latestPendingOrder.payment_amount_idr || latestPendingOrder.total_amount_idr)}
              </strong>
            </div>
            <div className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Kode unik</p>
              <strong className="mt-2 block text-2xl font-extrabold text-[#1A1A1A]">
                {latestPendingOrder.unique_amount_idr || 0}
              </strong>
            </div>
            <div className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Referensi</p>
              <strong className="mt-2 block text-sm font-bold text-[#1A1A1A]">
                {latestPendingOrder.payment_reference || "-"}
              </strong>
            </div>
            <div className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Batas bayar</p>
              <strong className="mt-2 block text-sm font-bold text-[#1A1A1A]">
                {latestPendingOrder.payment_expires_at ? formatDate(latestPendingOrder.payment_expires_at) : "-"}
              </strong>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#F0EDE8] px-4 py-3 text-sm text-[#6B6B6B]">
              <div className="font-semibold text-[#1A1A1A]">Provider</div>
              {(paymentInstructions?.wallet_provider as string) ?? "DANA"}
            </div>
            <div className="rounded-xl border border-[#F0EDE8] px-4 py-3 text-sm text-[#6B6B6B]">
              <div className="font-semibold text-[#1A1A1A]">Pemilik QRIS</div>
              {(paymentInstructions?.qris_owner_name as string) || "-"}
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-[#F0EDE8] bg-[#FCFBFA] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">QR pembayaran</p>
              <div className="mt-3 flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-[#E5E5E5] bg-white p-3">
                {qrisImageURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrisImageURL} alt="QRIS pembayaran" className="h-auto max-w-full" />
                ) : qrisDataURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrisDataURL} alt="QRIS pembayaran" className="h-auto max-w-full" />
                ) : (
                  <span className="text-center text-sm text-[#6B6B6B]">
                    Raw string QRIS belum diisi di panel super admin.
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-[#F0EDE8] bg-[#FCFBFA] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Raw string QRIS</p>
                  <p className="mt-1 text-sm text-[#6B6B6B]">
                    Ini string QRIS asli milik Anda yang disimpan di panel super admin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyQRIS()}
                  disabled={!qrisPayload.trim()}
                  className="rounded-xl border border-[#1A1A1A] px-3 py-2 text-xs font-bold text-[#1A1A1A] disabled:opacity-50"
                >
                  Copy String
                </button>
              </div>
              <textarea
                readOnly
                value={qrisPayload}
                className="mt-3 min-h-[220px] w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-xs text-[#1A1A1A]"
                placeholder="Raw string QRIS belum diisi."
              />
            </div>
          </div>
          <p className="mt-4 text-sm text-[#6B6B6B]">
            Setelah notifikasi pembayaran masuk ke Android forwarder, order ini akan berubah otomatis menjadi aktif bila nominalnya cocok.
          </p>
        </article>
      ) : null}

      <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#F0EDE8] px-6 py-4">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Riwayat order paket</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
              <tr>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Coupon</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Nominal bayar</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-[#F0EDE8]">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-[#1A1A1A]">{order.plan_name}</p>
                    <p className="text-xs uppercase text-[#A3A3A3]">{order.plan_code}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#6B6B6B]">{order.billing_cycle}</td>
                  <td className="px-4 py-4 text-sm text-[#6B6B6B]">{order.coupon_code || "-"}</td>
                  <td className="px-4 py-4 text-sm text-[#1A1A1A]">{formatIDR(order.total_amount_idr)}</td>
                  <td className="px-4 py-4 text-sm text-[#1A1A1A]">
                    {order.payment_amount_idr ? formatIDR(order.payment_amount_idr) : "-"}
                  </td>
                  <td className="px-4 py-4 text-sm uppercase text-[#6B6B6B]">{order.status}</td>
                  <td className="px-4 py-4 text-sm text-[#6B6B6B]">{formatDate(order.created_at)}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#A3A3A3]">
                    Belum ada order paket.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
