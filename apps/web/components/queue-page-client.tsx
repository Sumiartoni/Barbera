"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { TenantPageFrame } from "./tenant-page-frame";
import { formatDate } from "./tenant-utils";
import { useTenantSession } from "./use-tenant-session";

type QueueTicket = {
  id: string;
  queue_number: number;
  customer_name: string;
  service_summary: string;
  preferred_barber: string;
  assigned_barber: string;
  station_name: string;
  status: string;
  source: string;
  estimated_wait_minutes: number;
  requested_at: string;
};

export function QueuePageClient() {
  const session = useTenantSession();
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function loadData() {
    if (!session?.access_token) return;
    try {
      setError("");
      const response = await apiRequest<{ tickets: QueueTicket[] }>("/api/v1/queue", {
        token: session.access_token,
      });
      setTickets(response.tickets);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memuat antrean tenant.");
    }
  }

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => void loadData(), 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function handleStatus(ticketId: string, status: "in_service" | "done" | "canceled") {
    if (!session?.access_token) return;
    try {
      setBusyId(ticketId);
      setError("");
      await apiRequest(`/api/v1/queue/${ticketId}/status`, {
        method: "POST",
        token: session.access_token,
        body: { status },
      });
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memperbarui status antrean.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <TenantPageFrame
      session={session}
      active="queue"
      title="Antrian Live"
      description="Pantau antrean aktif tenant, nomor antrean, barber yang bertugas, dan link antrean publik customer."
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <article className="bg-white border border-[#F0EDE8] rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-[#F0EDE8] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Antrean aktif tenant</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3">Barber</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Estimasi</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-[#F0EDE8] align-top">
                    <td className="px-4 py-4 font-semibold text-[#1A1A1A]">#{ticket.queue_number}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#1A1A1A]">{ticket.customer_name}</p>
                      <p className="text-sm text-[#6B6B6B]">{ticket.service_summary || "-"}</p>
                      <p className="text-xs text-[#A3A3A3] mt-1">
                        {formatDate(ticket.requested_at)} • {ticket.source === "whatsapp" ? "Booking WA" : ticket.source === "walk_in" ? "Walk-in" : "Booking"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#6B6B6B]">
                      <p>{ticket.assigned_barber || ticket.preferred_barber || "-"}</p>
                      <p className="text-xs text-[#A3A3A3] mt-1">{ticket.station_name || "-"}</p>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-[#1A1A1A] uppercase">{ticket.status}</td>
                    <td className="px-4 py-4 text-sm text-[#6B6B6B]">
                      {ticket.status === "in_service" ? "Sedang dikerjakan" : `${ticket.estimated_wait_minutes || 0} menit`}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {ticket.status !== "in_service" && ticket.status !== "done" ? (
                          <button
                            type="button"
                            onClick={() => void handleStatus(ticket.id, "in_service")}
                            disabled={busyId === ticket.id}
                            className="rounded-xl border border-[#C8A464] px-3 py-2 text-xs font-bold text-[#C8A464] disabled:opacity-70"
                          >
                            Layani
                          </button>
                        ) : null}
                        {ticket.status === "in_service" ? (
                          <button
                            type="button"
                            onClick={() => void handleStatus(ticket.id, "done")}
                            disabled={busyId === ticket.id}
                            className="rounded-xl bg-[#1A1A1A] px-3 py-2 text-xs font-bold text-white disabled:opacity-70"
                          >
                            Selesai
                          </button>
                        ) : null}
                        {ticket.status === "waiting" || ticket.status === "assigned" ? (
                          <button
                            type="button"
                            onClick={() => void handleStatus(ticket.id, "canceled")}
                            disabled={busyId === ticket.id}
                            className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-70"
                          >
                            Batalkan
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </TenantPageFrame>
  );
}
