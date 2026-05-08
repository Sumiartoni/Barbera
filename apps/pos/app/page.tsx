"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

import { clientRequest } from "@/lib/client-api";

type POSSession = {
  staff: {
    id: string;
    barber_id: string;
    full_name: string;
    role: string;
    access_code: string;
  };
  tenant: {
    id: string;
    name: string;
    public_queue_url: string;
  };
  expires_at?: string;
};

type QueueTicket = {
  id: string;
  queue_number: number;
  customer_name: string;
  service_summary: string;
  status: "waiting" | "assigned" | "in_service" | "done" | "canceled";
  assigned_barber: string;
  station_name: string;
  requested_at: string;
};

const STATUS_CONFIG = {
  waiting: { label: "Menunggu", className: "badge-warning", dot: "var(--warning)" },
  assigned: { label: "Siap", className: "badge-warning", dot: "var(--gold)" },
  in_service: { label: "Dilayani", className: "badge-success", dot: "var(--success)" },
  done: { label: "Selesai", className: "badge-muted", dot: "var(--text-muted)" },
  canceled: { label: "Batal", className: "badge-muted", dot: "var(--danger)" },
} as const;

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatWaited(value: string) {
  const requested = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - requested) / 60000));
  if (diffMinutes < 1) {
    return "baru masuk";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} mnt`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `${hours}j ${minutes}m`;
}

function QueueItem({
  item,
  onStatusChange,
  busy,
}: {
  item: QueueTicket;
  onStatusChange: (ticketId: string, status: "in_service" | "done") => void;
  busy: boolean;
}) {
  const status = STATUS_CONFIG[item.status];
  return (
    <div id={`queue-item-${item.id}`} className="queue-item">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg"
        style={{
          background: item.status === "in_service" ? "var(--gold-glow)" : "var(--surface-3)",
          color: item.status === "in_service" ? "var(--gold)" : "var(--text-muted)",
          border:
            item.status === "in_service"
              ? "1px solid var(--gold)"
              : "1px solid var(--border-subtle)",
        }}
      >
        {item.queue_number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
          {item.customer_name}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {item.service_summary}
          {item.assigned_barber ? (
            <span>
              {" "}
              · <span style={{ color: "var(--gold)" }}>{item.assigned_barber}</span>
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`badge ${status.className}`}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: status.dot,
              display: "inline-block",
            }}
          />
          {status.label}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {formatWaited(item.requested_at)}
        </span>
        <div className="flex items-center gap-2">
          {item.status !== "in_service" && item.status !== "done" ? (
            <button
              onClick={() => onStatusChange(item.id, "in_service")}
              disabled={busy}
              className="px-3 py-1.5 text-[11px] font-bold rounded-full"
              style={{
                background: "var(--gold-glow)",
                color: "var(--gold)",
                border: "1px solid var(--gold)",
                opacity: busy ? 0.6 : 1,
              }}
            >
              Layani
            </button>
          ) : null}
          {item.status === "in_service" ? (
            <button
              onClick={() => onStatusChange(item.id, "done")}
              disabled={busy}
              className="px-3 py-1.5 text-[11px] font-bold rounded-full"
              style={{
                background: "rgba(76, 175, 122, 0.1)",
                color: "var(--success)",
                border: "1px solid rgba(76, 175, 122, 0.24)",
                opacity: busy ? 0.6 : 1,
              }}
            >
              Selesai
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PosDashboard() {
  const [activeTab, setActiveTab] = useState<"queue" | "done">("queue");
  const [session, setSession] = useState<POSSession | null>(null);
  const [queue, setQueue] = useState<QueueTicket[]>([]);
  const [error, setError] = useState("");
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadData() {
    try {
      setError("");
      const [me, queueResponse] = await Promise.all([
        clientRequest<POSSession>("/api/auth/me"),
        clientRequest<{ tickets: QueueTicket[] }>("/api/queue"),
      ]);
      setSession(me);
      setQueue(queueResponse.tickets);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memuat dashboard POS.",
      );
    }
  }

  useEffect(() => {
    void loadData();
    const polling = window.setInterval(() => {
      void loadData();
    }, 15_000);
    return () => window.clearInterval(polling);
  }, []);

  async function handleStatusChange(ticketId: string, status: "in_service" | "done") {
    try {
      setBusyTicketId(ticketId);
      setError("");
      await clientRequest(`/api/queue/${ticketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memperbarui antrean.",
      );
    } finally {
      setBusyTicketId(null);
    }
  }

  const activeQueue = useMemo(
    () => queue.filter((item) => item.status !== "done" && item.status !== "canceled"),
    [queue],
  );
  const doneQueue = useMemo(() => queue.filter((item) => item.status === "done"), [queue]);
  const currentServing = activeQueue.filter((item) => item.status === "in_service").length;

  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="pos-page">
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="pos-container">
          <div className="flex items-center justify-between py-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full pulse-gold" style={{ background: "var(--gold)" }} />
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--gold)" }}>
                  {session?.tenant.name ?? "Barbera POS"}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full hidden sm:inline"
                  style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}
                >
                  {session?.staff.access_code ?? "akses"}
                </span>
              </div>
              <p className="text-sm capitalize" style={{ color: "var(--text-muted)" }}>
                {dateStr}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
                {timeStr}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {session?.staff.full_name ?? "Barber"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="pos-content pos-container">
        {error ? (
          <div
            className="mt-4 rounded-2xl px-4 py-3 text-sm font-medium"
            style={{ background: "rgba(244, 67, 54, 0.1)", color: "var(--danger)" }}
          >
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-5 pb-2">
          <div className="metric-card">
            <span className="metric-label">Antrean Aktif</span>
            <span className="metric-value">{activeQueue.length}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: "var(--success)" }}>●</span> {currentServing} dilayani
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Barber Login</span>
            <span className="metric-value gold text-base">{session?.staff.full_name ?? "-"}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              akses pribadi aktif
            </span>
          </div>
          <div className="metric-card hidden md:flex">
            <span className="metric-label">Live Queue</span>
            <span className="metric-value">{activeQueue[0]?.queue_number ?? "-"}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              nomor terdepan
            </span>
          </div>
          <div className="metric-card hidden md:flex">
            <span className="metric-label">Link Publik</span>
            <span className="metric-value text-sm">
              {session?.tenant.public_queue_url ? "Aktif" : "Belum ada"}
            </span>
            <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {session?.tenant.public_queue_url ?? "atur di tenant"}
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 mt-5">
          <div className="flex-1 flex flex-col gap-4">
            <Link
              id="cta-input-customer"
              href="/transaction/new"
              className="btn-gold w-full py-4 text-base gap-3"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                borderRadius: "14px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#0A0A0B" strokeWidth="2.2" />
                <path d="M12 8v8M8 12h8" stroke="#0A0A0B" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              Input Pelanggan Baru
            </Link>

            <div className="flex rounded-xl p-1" style={{ background: "var(--surface-3)" }}>
              {(["queue", "done"] as const).map((tab) => (
                <button
                  key={tab}
                  id={`tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: activeTab === tab ? "var(--surface-2)" : "transparent",
                    color: activeTab === tab ? "var(--gold)" : "var(--text-muted)",
                    border:
                      activeTab === tab ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  {tab === "queue"
                    ? `Antrean (${activeQueue.length})`
                    : `Selesai (${doneQueue.length})`}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 animate-slide-up">
              {activeTab === "queue" &&
                activeQueue.map((item) => (
                  <QueueItem
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    busy={busyTicketId === item.id}
                  />
                ))}
              {activeTab === "done" &&
                doneQueue.map((item) => (
                  <QueueItem
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    busy={busyTicketId === item.id}
                  />
                ))}
              {activeTab === "queue" && activeQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="text-5xl">✂️</div>
                  <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Antrean Kosong
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="hidden lg:flex flex-col gap-4 w-80 shrink-0">
            <div className="card-pos">
              <p className="metric-label mb-3">Status Login</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: "var(--surface-3)", color: "var(--gold)" }}
                  >
                    {session?.staff.full_name?.slice(0, 1) ?? "B"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {session?.staff.full_name ?? "Barber"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {session?.staff.role ?? "barber"}
                    </p>
                  </div>
                  <span className="badge badge-success">Aktif</span>
                </div>
              </div>
            </div>

            <div className="card-pos">
              <p className="metric-label mb-3">Antrean Publik</p>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Link pemantauan customer
                </span>
                <p className="text-xs break-all" style={{ color: "var(--text-muted)" }}>
                  {session?.tenant.public_queue_url ?? "Belum diaktifkan dari tenant panel."}
                </p>
                {session?.tenant.public_queue_url ? (
                  <a
                    href={session.tenant.public_queue_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-gold w-full py-3 text-sm mt-2"
                  >
                    Buka Live Queue
                  </a>
                ) : null}
              </div>
            </div>
          </aside>
        </div>

        <div className="h-5" />
      </div>

      <BottomNav />
    </div>
  );
}
