"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import { loadSession, syncSessionProfile, type SessionState } from "../lib/session";
import { TenantShell } from "./tenant-shell";

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
  setup: {
    barbers_count: number;
    services_count: number;
    stations_count: number;
    primary_outlet_ready: boolean;
    whatsapp_connected: boolean;
    public_queue_enabled: boolean;
    setup_ready_score: number;
  };
  recent_customers: Array<{
    id: string;
    full_name: string;
    phone_number: string;
    preferred_barber: string;
    last_visit_at?: string;
    total_visits: number;
  }>;
  recent_visits: Array<{
    id: string;
    customer_id: string;
    customer_name: string;
    service_name: string;
    barber_name: string;
    amount_idr: number;
    payment_status: string;
    visit_at: string;
    next_reminder_at?: string;
  }>;
};

function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatHour(value?: string) {
  if (!value) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function DashboardPageClient() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const activeSession = loadSession();
    setSession(activeSession);

    if (!activeSession?.access_token) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const refreshedSession = await syncSessionProfile();
        if (refreshedSession) {
          setSession(refreshedSession);
        }

        const result = await apiRequest<DashboardSummary>("/api/v1/dashboard/summary", {
          token: (refreshedSession ?? activeSession).access_token
        });
        setSummary(result);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Gagal memuat dashboard CRM."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!session) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center p-4">
        <section className="bg-white rounded-2xl shadow-xl border border-[#F0EDE8] p-8 max-w-md w-full mx-auto text-center">
          <p className="text-sm font-semibold tracking-wider text-[#C8A464] mb-2 uppercase">Barbera CRM</p>
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-4">Session belum tersedia.</h1>
          <p className="text-[#6B6B6B] mb-8">
            Login dulu dari halaman tenant agar dashboard bisa mengambil data customer dan kunjungan.
          </p>
          <div className="pt-2 border-t border-[#F0EDE8]">
            <Link href="/login" className="inline-flex items-center justify-center w-full py-3 bg-[#C8A464] hover:bg-[#B89454] text-white rounded-xl font-semibold transition-colors mt-4">
              Ke Halaman Login
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const revenueSeries = buildRevenueSeries(summary?.recent_visits ?? []);
  const bestBarber = buildBestBarber(summary?.recent_visits ?? []);
  const repeatRate = getRepeatRate(summary?.stats.total_customers ?? 0, summary?.stats.active_customers_30d ?? 0);

  return (
    <TenantShell
      session={session}
      active="dashboard"
      title="Ikhtisar Eksekutif"
      description="Ringkasan operasional harian, retensi pelanggan, dan kesehatan kursi aktif di tenant Anda."
      actions={
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex px-3 py-1.5 bg-white border border-[#E5E5E5] text-[#6B6B6B] text-xs font-bold rounded-lg shadow-sm">
            24 Jam Terakhir
          </span>
          <Link href="/pos" className="px-4 py-2 bg-[#C8A464] text-white text-sm font-bold rounded-lg hover:bg-[#B89454] shadow-sm transition-colors">
            Buka POS Front Desk
          </Link>
        </div>
      }
    >
      {error ? (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl font-medium">
          {error}
        </div>
      ) : null}
      
      {loading ? (
        <div className="mb-6 p-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-medium flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          Memuat ringkasan CRM...
        </div>
      ) : null}

      {summary ? (
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-[#F0EDE8] p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-6">
              <div>
                <p className="text-xs font-bold tracking-wider text-[#A3A3A3] uppercase mb-1">Setup 5 menit</p>
                <h2 className="text-lg font-bold text-[#1A1A1A]">Checklist go-live barbershop</h2>
              </div>
              <div className="inline-flex items-center gap-3 rounded-xl border border-[#F0EDE8] px-4 py-3 bg-[#FCFBFA]">
                <div className="h-2 w-28 rounded-full bg-[#EAE6DF] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#C8A464]"
                    style={{ width: `${summary.setup.setup_ready_score}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-[#1A1A1A]">{summary.setup.setup_ready_score}% siap</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[
                {
                  label: "Outlet utama aktif",
                  done: summary.setup.primary_outlet_ready,
                  detail: "Dasar operasional tenant"
                },
                {
                  label: "Layanan aktif",
                  done: summary.setup.services_count > 0,
                  detail: `${summary.setup.services_count} layanan siap dipakai`
                },
                {
                  label: "Barber terdaftar",
                  done: summary.setup.barbers_count > 0,
                  detail: `${summary.setup.barbers_count} barber aktif`
                },
                {
                  label: "Kursi/station aktif",
                  done: summary.setup.stations_count > 0,
                  detail: `${summary.setup.stations_count} kursi aktif`
                },
                {
                  label: "WhatsApp terhubung",
                  done: summary.setup.whatsapp_connected,
                  detail: "Siap terima booking dari chat"
                },
                {
                  label: "Antrean publik aktif",
                  done: summary.setup.public_queue_enabled,
                  detail: "Customer bisa pantau antrean live"
                }
              ].map((item) => (
                <article
                  key={item.label}
                  className={`rounded-2xl border px-4 py-4 ${
                    item.done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-[#F0EDE8] bg-[#FCFBFA]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1A1A1A]">{item.label}</p>
                      <p className="text-xs text-[#6B6B6B] mt-1">{item.detail}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        item.done
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-white text-[#A3A3A3] border border-[#E5E5E5]"
                      }`}
                    >
                      {item.done ? "Siap" : "Perlu setup"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Executive Metrics */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <article className="bg-white rounded-2xl border border-[#F0EDE8] p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#C8A464]/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="w-10 h-10 rounded-xl bg-[#C8A464]/10 text-[#C8A464] flex items-center justify-center font-bold text-lg mb-4">◈</div>
              <span className="text-sm text-[#6B6B6B] font-medium mb-1">Pendapatan 30 Hari</span>
              <strong className="text-2xl font-extrabold text-[#1A1A1A] mb-1">{formatIDR(summary.stats.revenue_30d_idr)}</strong>
              <p className="text-xs text-[#A3A3A3] mb-4">{formatIDR(summary.stats.average_ticket_30d_idr)} rata-rata tiket</p>
              <span className="mt-auto inline-flex items-center self-start text-[10px] font-bold tracking-wider text-[#C8A464] bg-[#C8A464]/10 px-2 py-1 rounded uppercase">↑ Hari ini aktif</span>
            </article>

            <article className="bg-white rounded-2xl border border-[#F0EDE8] p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg mb-4">◉</div>
              <span className="text-sm text-[#6B6B6B] font-medium mb-1">Kunjungan dan Pelanggan</span>
              <strong className="text-2xl font-extrabold text-[#1A1A1A] mb-1">{formatCompact(summary.stats.visits_30d)}</strong>
              <p className="text-xs text-[#A3A3A3] mb-4">{summary.stats.active_customers_30d} pelanggan aktif dalam 30 hari</p>
              <span className="mt-auto inline-flex items-center self-start text-[10px] font-bold tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">↑ {summary.stats.total_customers} total</span>
            </article>

            <article className="bg-white rounded-2xl border border-[#F0EDE8] p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg mb-4">⬡</div>
              <span className="text-sm text-[#6B6B6B] font-medium mb-1">Kursi dan Shift Aktif</span>
              <strong className="text-2xl font-extrabold text-[#1A1A1A] mb-1">{summary.stats.barbers_on_shift_now}</strong>
              <p className="text-xs text-[#A3A3A3] mb-4">{summary.stats.active_stations} kursi aktif siap dipakai hari ini</p>
              <span className="mt-auto inline-flex items-center self-start text-[10px] font-bold tracking-wider text-amber-600 bg-amber-50 px-2 py-1 rounded uppercase">↑ On shift sekarang</span>
            </article>

            <article className="bg-white rounded-2xl border border-[#F0EDE8] p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg mb-4">◆</div>
              <span className="text-sm text-[#6B6B6B] font-medium mb-1">Retensi Siap Digarap</span>
              <strong className="text-2xl font-extrabold text-[#1A1A1A] mb-1">{summary.stats.dormant_customers_30d}</strong>
              <p className="text-xs text-[#A3A3A3] mb-4">{summary.stats.upcoming_reminders_7d} reminder jatuh tempo 7 hari</p>
              <span className="mt-auto inline-flex items-center self-start text-[10px] font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase">↑ Follow-up aktif</span>
            </article>
          </section>

          {/* Grid Panel 2 Columns */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <article className="bg-white rounded-2xl border border-[#F0EDE8] p-6 shadow-sm flex flex-col">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <p className="text-xs font-bold tracking-wider text-[#A3A3A3] uppercase mb-1">Arus pendapatan</p>
                  <h2 className="text-lg font-bold text-[#1A1A1A]">Performa transaksi terbaru</h2>
                </div>
                <span className="text-xs font-medium text-[#6B6B6B] bg-[#F5F5F5] px-2 py-1 rounded-md">Haircut &bull; Service</span>
              </div>

              <div className="flex-1 flex items-end justify-between gap-1 mt-4 h-48" aria-hidden="true">
                {revenueSeries.map((entry, index) => (
                  <div key={`${entry.label}-${index}`} className="flex flex-col items-center gap-3 w-full group cursor-crosshair">
                    <div className="w-full bg-[#FCFBFA] rounded-md overflow-hidden relative flex flex-col justify-end" style={{ height: "140px" }}>
                      <span
                        className={`w-full rounded-md transition-all duration-500 ease-out ${
                          entry.highlight ? "bg-[#C8A464]" : "bg-[#E5E5E5] group-hover:bg-[#D4D4D4]"
                        }`}
                        style={{ height: `${entry.height}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[#A3A3A3]">{entry.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="bg-white rounded-2xl border border-[#F0EDE8] p-6 shadow-sm flex flex-col">
              <div className="mb-6">
                <p className="text-xs font-bold tracking-wider text-[#A3A3A3] uppercase mb-1">Fokus retensi</p>
                <h2 className="text-lg font-bold text-[#1A1A1A]">Prioritas owner hari ini</h2>
              </div>

              <div className="flex-1 flex flex-col gap-4">
                <article className="flex items-center justify-between p-4 rounded-xl border border-[#F0EDE8] bg-[#FCFBFA]">
                  <div className="flex flex-col">
                    <strong className="text-[#1A1A1A] font-semibold">Pelanggan Pasif</strong>
                    <span className="text-sm text-[#6B6B6B]">{summary.stats.dormant_customers_30d} risiko tinggi</span>
                  </div>
                  <b className="text-xl font-extrabold text-red-500">{summary.stats.dormant_customers_30d}</b>
                </article>

                <article className="flex items-center justify-between p-4 rounded-xl border border-[#F0EDE8] bg-[#FCFBFA]">
                  <div className="flex flex-col">
                    <strong className="text-[#1A1A1A] font-semibold">Tingkat Repeat</strong>
                    <span className="text-sm text-[#6B6B6B]">{summary.stats.active_customers_30d} dari {summary.stats.total_customers} pelanggan aktif</span>
                  </div>
                  <b className="text-xl font-extrabold text-[#C8A464]">{repeatRate}%</b>
                </article>

                <article className="flex items-center justify-between p-4 rounded-xl border border-[#F0EDE8] bg-[#FCFBFA]">
                  <div className="flex flex-col">
                    <strong className="text-[#1A1A1A] font-semibold">Poin Follow-up</strong>
                    <span className="text-sm text-[#6B6B6B]">{summary.stats.upcoming_reminders_7d} reminder jatuh tempo</span>
                  </div>
                  <b className="text-xl font-extrabold text-[#1A1A1A]">{summary.stats.upcoming_reminders_7d}</b>
                </article>
              </div>

              <Link href="/pos" className="block w-full py-3 mt-6 text-center font-bold text-sm text-[#1A1A1A] border-2 border-[#E5E5E5] rounded-xl hover:border-[#C8A464] hover:text-[#C8A464] transition-colors">
                Luncurkan POS Front Desk
              </Link>
            </article>
          </section>

          {/* Micro Status Grids */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="bg-[#1A1A1A] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
               <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
              <p className="text-xs font-bold tracking-wider text-white/50 uppercase mb-2">Antrean langsung</p>
              <h3 className="text-lg font-bold mb-6">Monitor kursi aktif</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-sm text-white/70 mb-1">Dalam antrean</span>
                  <strong className="text-2xl font-extrabold text-[#C8A464]">{summary.stats.active_queue_tickets}</strong>
                </div>
                <div>
                  <span className="block text-sm text-white/70 mb-1">Barber on shift</span>
                  <strong className="text-2xl font-extrabold">{summary.stats.barbers_on_shift_now}</strong>
                </div>
              </div>
            </article>

            <article className="bg-gradient-to-br from-[#C8A464] to-[#B89454] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[100px]"></div>
              <p className="text-xs font-bold tracking-wider text-white/70 uppercase mb-2">Barber terbaik</p>
              <h3 className="text-2xl font-bold mb-8">{bestBarber.name}</h3>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{bestBarber.visits} layanan tercatat</span>
                <span className="text-sm font-bold text-white bg-black/20 self-start px-2 py-0.5 rounded">{formatIDR(bestBarber.revenue)} omzet terbaru</span>
              </div>
            </article>

            <article className="bg-white rounded-2xl border border-[#F0EDE8] p-6 shadow-sm">
              <p className="text-xs font-bold tracking-wider text-[#A3A3A3] uppercase mb-2">Inbox WhatsApp</p>
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Command shift siap dipakai</h3>
              <div className="bg-[#F5F5F5] rounded-xl p-4">
                <span className="block text-[#1A1A1A] font-semibold mb-2">{summary.stats.upcoming_reminders_7d} reminder siap diproses</span>
                <p className="text-xs text-[#6B6B6B] leading-relaxed">
                  Gunakan format <code className="bg-white px-1 py-0.5 rounded border border-[#E5E5E5] text-[#1A1A1A] font-mono">SHIFT ADD|Nama|YYYY-MM-DD|09:00|17:00</code> saat modul inbox tenant diatur.
                </p>
              </div>
            </article>
          </section>

          {/* Tables */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customers */}
            <article className="bg-white rounded-2xl border border-[#F0EDE8] shadow-sm flex flex-col overflow-hidden">
              <div className="p-6 border-b border-[#F0EDE8]">
                <p className="text-xs font-bold tracking-wider text-[#A3A3A3] uppercase mb-1">Pelanggan terbaru</p>
                <h2 className="text-lg font-bold text-[#1A1A1A]">Pelanggan CRM</h2>
              </div>
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: "400px" }}>
                {summary.recent_customers.map((customer, idx) => (
                  <article key={customer.id} className={`p-4 flex items-center justify-between gap-4 hover:bg-[#FCFBFA] transition-colors ${idx !== summary.recent_customers.length - 1 ? 'border-b border-[#F0EDE8]' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <strong className="text-sm font-bold text-[#1A1A1A] block truncate">{customer.full_name}</strong>
                      <p className="text-xs text-[#6B6B6B] font-mono mt-0.5">{customer.phone_number}</p>
                    </div>
                    <div className="flex-1 min-w-0 hidden sm:block">
                      <span className="text-sm text-[#1A1A1A] block truncate">{customer.preferred_barber || "Belum memilih barber"}</span>
                      <p className="text-xs text-[#A3A3A3] mt-0.5">{customer.total_visits} kunjungan</p>
                    </div>
                    <time className="text-xs font-semibold text-[#A3A3A3] whitespace-nowrap">{formatDate(customer.last_visit_at)}</time>
                  </article>
                ))}
              </div>
            </article>

            {/* Transactions */}
            <article className="bg-white rounded-2xl border border-[#F0EDE8] shadow-sm flex flex-col overflow-hidden">
              <div className="p-6 border-b border-[#F0EDE8] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-wider text-[#A3A3A3] uppercase mb-1">Transaksi terbaru</p>
                  <h2 className="text-lg font-bold text-[#1A1A1A]">Aktivitas pembayaran</h2>
                </div>
                <Link href="/pos" className="text-sm font-bold text-[#C8A464] hover:text-[#B89454] transition-colors">
                  Input transaksi &rarr;
                </Link>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FCFBFA] border-b border-[#F0EDE8]">
                      <th className="px-4 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Pelanggan</th>
                      <th className="px-4 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Layanan</th>
                      <th className="px-4 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Jumlah</th>
                      <th className="px-4 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Barber</th>
                      <th className="px-4 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recent_visits.map((visit) => (
                      <tr key={visit.id} className="border-b border-[#F0EDE8] hover:bg-[#FCFBFA] transition-colors last:border-b-0">
                        <td className="px-4 py-3 text-xs font-mono text-[#A3A3A3]">#{visit.id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <strong className="text-sm text-[#1A1A1A] block">{visit.customer_name}</strong>
                          <div className="text-xs text-[#6B6B6B] mt-0.5">{formatHour(visit.visit_at)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#1A1A1A]">{visit.service_name}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#1A1A1A]">{formatIDR(visit.amount_idr)}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{visit.barber_name || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase ${
                            visit.payment_status === "paid"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              : "bg-amber-50 text-amber-600 border border-amber-100"
                          }`}>
                            {visit.payment_status === "paid" ? "Selesai" : "Proses"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </div>
      ) : null}
    </TenantShell>
  );
}

function buildRevenueSeries(visits: DashboardSummary["recent_visits"]) {
  const records = visits.slice(0, 8).reverse();
  const max = Math.max(...records.map((visit) => visit.amount_idr), 1);

  return Array.from({ length: 8 }, (_, index) => {
    const visit = records[index];
    if (!visit) {
      return {
        label: `${9 + index}:00`,
        height: 18,
        highlight: false
      };
    }

    return {
      label: formatHour(visit.visit_at),
      height: Math.max(24, Math.round((visit.amount_idr / max) * 100)),
      highlight: index === records.length - 1
    };
  });
}

function buildBestBarber(visits: DashboardSummary["recent_visits"]) {
  const summary = new Map<string, { visits: number; revenue: number }>();

  for (const visit of visits) {
    const key = visit.barber_name || "Belum dipilih";
    const current = summary.get(key) ?? { visits: 0, revenue: 0 };
    current.visits += 1;
    current.revenue += visit.amount_idr;
    summary.set(key, current);
  }

  const [name, stats] =
    [...summary.entries()].sort((left, right) => {
      if (right[1].visits !== left[1].visits) {
        return right[1].visits - left[1].visits;
      }
      return right[1].revenue - left[1].revenue;
    })[0] ?? ["Belum ada data", { visits: 0, revenue: 0 }];

  return {
    name,
    visits: stats.visits,
    revenue: stats.revenue
  };
}

function getRepeatRate(totalCustomers: number, activeCustomers: number) {
  if (totalCustomers <= 0) {
    return 0;
  }

  return Math.round((activeCustomers / totalCustomers) * 100);
}
