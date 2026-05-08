"use client";

import { useEffect, useState } from "react";

import { apiURL } from "../lib/api";

type PublicQueueView = {
  tenant_name: string;
  public_queue_id: string;
  waiting_count: number;
  in_service_count: number;
  active_stations: number;
  barbers_on_shift: number;
  updated_at: string;
  tickets: Array<{
    id: string;
    queue_number: number;
    customer_name: string;
    service_summary: string;
    status: string;
    assigned_barber: string;
    station_name: string;
    estimated_wait_minutes: number;
    requested_at: string;
  }>;
};

export function PublicQueuePageClient({ publicQueueID }: { publicQueueID: string }) {
  const [view, setView] = useState<PublicQueueView | null>(null);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      const response = await fetch(apiURL(`/api/v1/public/queue/${publicQueueID}`), {
        cache: "no-store",
      });
      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : null;
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Gagal memuat antrean publik.");
      }
      setView(data as PublicQueueView);
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memuat antrean publik.",
      );
    }
  }

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => void loadData(), 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicQueueID]);

  return (
    <main className="min-h-screen bg-[#FAF8F5] px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-[#F0EDE8] bg-white px-6 py-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#C8A464]">Barbera Live Queue</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#1A1A1A]">
            {view?.tenant_name ?? "Memuat antrean..."}
          </h1>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            Pantau nomor antrean secara live tanpa perlu chat ulang ke barber.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Menunggu", String(view?.waiting_count ?? 0)],
            ["Sedang dilayani", String(view?.in_service_count ?? 0)],
            ["Barber aktif", String(view?.barbers_on_shift ?? 0)],
            ["Kursi aktif", String(view?.active_stations ?? 0)],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-[#F0EDE8] bg-white px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">{label}</p>
              <p className="mt-2 text-2xl font-extrabold text-[#1A1A1A]">{value}</p>
            </article>
          ))}
        </section>

        <article className="rounded-3xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#F0EDE8] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Nomor antrean aktif</h2>
          </div>
          <div className="divide-y divide-[#F0EDE8]">
            {view?.tickets.map((ticket) => (
              <div key={ticket.id} className="px-6 py-4 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#C8A464]/10 text-lg font-extrabold text-[#C8A464]">
                  {ticket.queue_number}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#1A1A1A]">{ticket.customer_name}</p>
                  <p className="text-sm text-[#6B6B6B]">{ticket.service_summary || "Layanan umum"}</p>
                  <p className="text-xs text-[#A3A3A3] mt-1">
                    {ticket.assigned_barber || "Menunggu barber"} • {ticket.station_name || "Belum assign kursi"}
                  </p>
                  <p className="text-xs text-[#A3A3A3] mt-1">
                    {ticket.status === "in_service" ? "Sedang dikerjakan sekarang" : `Estimasi tunggu sekitar ${ticket.estimated_wait_minutes || 0} menit`}
                  </p>
                </div>
                <div className="rounded-full bg-[#F5F5F5] px-3 py-1 text-xs font-bold uppercase text-[#6B6B6B]">
                  {ticket.status}
                </div>
              </div>
            ))}
            {!view?.tickets.length ? (
              <div className="px-6 py-12 text-center text-sm text-[#6B6B6B]">
                Tidak ada antrean aktif saat ini.
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </main>
  );
}
