"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";

import { clientRequest } from "@/lib/client-api";

type Visit = {
  id: string;
  customer_name: string;
  service_name: string;
  amount_idr: number;
  payment_status: string;
  visit_at: string;
};

function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PosHistoryPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await clientRequest<{ visits: Visit[] }>("/api/history");
        setVisits(response.visits);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Gagal memuat riwayat transaksi.",
        );
      }
    })();
  }, []);

  return (
    <div className="pos-page min-h-dvh flex flex-col">
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="pos-container py-4">
          <h1 className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Riwayat Kunjungan
          </h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Riwayat transaksi terbaru tenant Anda
          </p>
        </div>
      </header>

      <div className="pos-content pos-container pt-5 flex-1">
        {error ? (
          <div
            className="rounded-2xl px-4 py-3 text-sm font-medium"
            style={{ background: "rgba(244, 67, 54, 0.1)", color: "var(--danger)" }}
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {visits.map((visit) => (
            <div key={visit.id} className="queue-item">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--surface-3)", color: "var(--gold)" }}
              >
                ✓
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                  {visit.customer_name}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {visit.service_name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: "var(--gold)" }}>
                  {formatIDR(visit.amount_idr)}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(visit.visit_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {!error && visits.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--text-muted)" }}>
              Belum ada riwayat kunjungan.
            </div>
          ) : null}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
