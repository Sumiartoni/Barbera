"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { TenantPageFrame } from "./tenant-page-frame";
import { formatDate, formatIDR } from "./tenant-utils";
import { useTenantSession } from "./use-tenant-session";

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

export function VisitsPageClient() {
  const session = useTenantSession();
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    void (async () => {
      try {
        setError("");
        const response = await apiRequest<{ visits: VisitRecord[] }>("/api/v1/visits?limit=30", {
          token: session.access_token,
        });
        setVisits(response.visits);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Gagal memuat daftar kunjungan.",
        );
      }
    })();
  }, [session?.access_token]);

  return (
    <TenantPageFrame
      session={session}
      active="visits"
      title="Kunjungan"
      description="Lihat daftar kunjungan, nominal transaksi, dan jadwal reminder yang sudah terbentuk."
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <article className="bg-white border border-[#F0EDE8] rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-[#F0EDE8] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Riwayat kunjungan</h2>
            <p className="text-sm text-[#6B6B6B]">
              Semua kunjungan terbaru yang tercatat oleh tenant Anda.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
                <tr>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3">Layanan</th>
                  <th className="px-4 py-3">Barber / Kursi</th>
                  <th className="px-4 py-3">Nominal</th>
                  <th className="px-4 py-3">Reminder</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id} className="border-t border-[#F0EDE8] align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#1A1A1A]">{visit.customer_name}</p>
                      <p className="text-sm text-[#6B6B6B]">{visit.phone_number}</p>
                      <p className="text-xs text-[#A3A3A3] mt-1">{formatDate(visit.visit_at)}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#1A1A1A]">
                      <p>{visit.service_name}</p>
                      {visit.notes ? (
                        <p className="text-xs text-[#A3A3A3] mt-1">{visit.notes}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#6B6B6B]">
                      <p>{visit.barber_name || "-"}</p>
                      <p className="text-xs text-[#A3A3A3] mt-1">{visit.station_name || "-"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#1A1A1A]">{formatIDR(visit.amount_idr)}</p>
                      <p className="text-xs text-[#A3A3A3] mt-1 uppercase">
                        {visit.payment_status}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#6B6B6B]">
                      {visit.next_reminder_at ? formatDate(visit.next_reminder_at) : "-"}
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
