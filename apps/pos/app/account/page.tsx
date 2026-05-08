"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";

import { clientRequest } from "@/lib/client-api";

type POSSession = {
  staff: {
    full_name: string;
    role: string;
    access_code: string;
  };
  tenant: {
    name: string;
    public_queue_url: string;
  };
};

export default function PosAccountPage() {
  const router = useRouter();
  const [session, setSession] = useState<POSSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const result = await clientRequest<POSSession>("/api/auth/me");
        setSession(result);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Gagal memuat akun POS.",
        );
      }
    })();
  }, []);

  async function handleLogout() {
    await clientRequest("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="pos-page min-h-dvh flex flex-col">
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="pos-container py-4">
          <h1 className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Akun Barber
          </h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Identitas akses POS dan link antrean publik tenant
          </p>
        </div>
      </header>

      <div className="pos-content pos-container pt-5 flex-1">
        {error ? (
          <div
            className="rounded-2xl px-4 py-3 text-sm font-medium mb-4"
            style={{ background: "rgba(244, 67, 54, 0.1)", color: "var(--danger)" }}
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          <div className="card-pos">
            <p className="metric-label mb-3">Akun aktif</p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Nama
                </span>
                <span className="text-sm font-semibold">{session?.staff.full_name ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Role
                </span>
                <span className="text-sm font-semibold">{session?.staff.role ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Kode akses
                </span>
                <span className="text-sm font-semibold">{session?.staff.access_code ?? "-"}</span>
              </div>
            </div>
          </div>

          <div className="card-pos">
            <p className="metric-label mb-3">Tenant</p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Barbershop
                </span>
                <span className="text-sm font-semibold">{session?.tenant.name ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Link antrean publik
                </span>
                <a
                  href={session?.tenant.public_queue_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold break-all"
                  style={{ color: "var(--gold)" }}
                >
                  {session?.tenant.public_queue_url ?? "-"}
                </a>
              </div>
            </div>
          </div>

          <button onClick={handleLogout} className="btn-gold w-full py-4 text-base">
            Logout POS
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
