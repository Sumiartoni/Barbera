"use client";

import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "../lib/api";
import { TenantPageFrame } from "./tenant-page-frame";
import { useTenantSession } from "./use-tenant-session";

type POSAccount = {
  barber_name: string;
  access_code: string;
  last_login_at?: string;
};

export function POSAccessPageClient() {
  const session = useTenantSession();
  const [accounts, setAccounts] = useState<POSAccount[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.access_token) return;
    void (async () => {
      try {
        const response = await apiRequest<{ accounts: POSAccount[] }>("/api/v1/barber-access", {
          token: session.access_token,
        });
        setAccounts(response.accounts);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Gagal memuat akses POS barber.");
      }
    })();
  }, [session?.access_token]);

  const publicQueueURL = useMemo(() => {
    if (!session) return "";
    return `${window.location.origin}/q/${session.tenant.public_queue_id ?? session.tenant.slug}`;
  }, [session]);

  return (
    <TenantPageFrame
      session={session}
      active="pos"
      title="Akses POS Barber"
      description="Bagikan kode akses dan PIN barber, lalu arahkan mereka login ke website POS terpisah."
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <article className="bg-white border border-[#F0EDE8] rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-4">Cara kerja login POS</h2>
            <ol className="space-y-3 text-sm text-[#6B6B6B] list-decimal pl-5">
              <li>Buat barber dan set PIN dari menu Barber.</li>
              <li>Berikan kode akses barber masing-masing.</li>
              <li>Barber login di website POS dengan kode akses + PIN.</li>
              <li>Customer bisa memantau antrean lewat website live queue.</li>
            </ol>
          </article>
          <article className="bg-white border border-[#F0EDE8] rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-4">Link penting tenant</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[#A3A3A3]">Website POS barber</p>
                <p className="font-semibold text-[#1A1A1A]">http://localhost:3002/login</p>
              </div>
              <div>
                <p className="text-[#A3A3A3]">Website antrean publik</p>
                <p className="font-semibold text-[#1A1A1A] break-all">{publicQueueURL}</p>
              </div>
            </div>
          </article>
        </section>

        <article className="bg-white border border-[#F0EDE8] rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-[#F0EDE8] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Kode akses barber</h2>
          </div>
          <div className="divide-y divide-[#F0EDE8]">
            {accounts.map((account) => (
              <div key={account.access_code} className="px-6 py-4">
                <p className="font-semibold text-[#1A1A1A]">{account.barber_name}</p>
                <p className="text-sm text-[#6B6B6B]">{account.access_code}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </TenantPageFrame>
  );
}
