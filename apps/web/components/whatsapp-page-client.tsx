"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { apiRequest } from "../lib/api";
import { TenantPageFrame } from "./tenant-page-frame";
import { formatDate } from "./tenant-utils";
import { useTenantSession } from "./use-tenant-session";

type WhatsAppConfig = {
  linked_number: string;
  linked_name: string;
  owner_commands_enabled: boolean;
  android_webhook_url: string;
  android_webhook_secret: string;
  default_queue_message: string;
  default_reminder_footer: string;
};

type CommandLog = {
  id: string;
  command_text: string;
  action: string;
  status: string;
  source: string;
  output_text: string;
  created_at: string;
};

type SessionState = {
  status: string;
  session_mode: string;
  phone_number: string;
  business_name: string;
  device_jid: string;
  pairing_code: string;
  pairing_qr: string;
  pairing_expires_at?: string;
  last_connected_at?: string;
  last_seen_at?: string;
  last_message_at?: string;
  last_error: string;
  is_connected: boolean;
  is_logged_in: boolean;
};

type Overview = {
  config: WhatsAppConfig;
  session: SessionState;
  command_catalog: string[];
  recent_logs: CommandLog[];
};

export function WhatsAppPageClient() {
  const session = useTenantSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [command, setCommand] = useState("QUEUE STATUS");
  const [commandResult, setCommandResult] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testMessage, setTestMessage] = useState("Tes koneksi WhatsApp BARBERA berhasil.");
  const [savingConfig, setSavingConfig] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [qrPreview, setQRPreview] = useState("");
  const [autoPairRequested, setAutoPairRequested] = useState(false);

  async function loadData() {
    if (!session?.access_token) return;
    try {
      setError("");
      const payload = await apiRequest<Overview>("/api/v1/whatsapp/overview", {
        token: session.access_token,
      });
      setOverview(payload);
      setTestPhoneNumber(payload.config.linked_number || payload.session?.phone_number || "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memuat modul WhatsApp owner.");
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  useEffect(() => {
    setAutoPairRequested(false);
  }, [session?.tenant?.id]);

  useEffect(() => {
    const qrPayload = overview?.session?.pairing_qr?.trim();
    if (!qrPayload) {
      setQRPreview("");
      return;
    }
    let active = true;
    QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 1,
      color: {
        dark: "#1A1A1A",
        light: "#FFFFFF",
      },
    })
      .then((value) => {
        if (active) {
          setQRPreview(value);
        }
      })
      .catch(() => {
        if (active) {
          setQRPreview("");
        }
      });
    return () => {
      active = false;
    };
  }, [overview?.session?.pairing_qr]);

  async function handleExecute() {
    if (!session?.access_token) return;
    try {
      setExecuting(true);
      setError("");
      setMessage("");
      const response = await apiRequest<Record<string, unknown>>("/api/v1/whatsapp/execute", {
        method: "POST",
        token: session.access_token,
        body: {
          command,
          source: "dashboard",
        },
      });
      const output =
        typeof response.output === "string" && response.output.trim()
          ? response.output
          : typeof response.message === "string"
            ? response.message
            : JSON.stringify(response, null, 2);
      setCommandResult(output);
      setMessage("Command owner berhasil diproses dan sudah dicatat ke log WhatsApp.");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Command owner gagal dijalankan.");
    } finally {
      setExecuting(false);
    }
  }

  async function handleStartQRPairing(options?: { silent?: boolean }) {
    if (!session?.access_token) return;
    try {
      setSessionSubmitting(true);
      setError("");
      if (!options?.silent) {
        setMessage("");
      }
      const payload = await apiRequest<SessionState>("/api/v1/whatsapp/session/pair-qr", {
        method: "POST",
        token: session.access_token,
      });
      setOverview((current) => (current ? { ...current, session: payload } : current));
      setMessage("QR pairing berhasil dibuat. Buka WhatsApp > Perangkat Tertaut > Tautkan Perangkat, lalu scan QR ini.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal membuat QR pairing WhatsApp.");
    } finally {
      setSessionSubmitting(false);
    }
  }

  useEffect(() => {
    if (!session?.access_token || !overview || autoPairRequested || sessionSubmitting) {
      return;
    }

    const currentSession = overview.session;
    const shouldAutoGenerateQR =
      !currentSession.is_connected &&
      !currentSession.is_logged_in &&
      !currentSession.pairing_qr &&
      ["", "disconnected", "error", "logged_out"].includes((currentSession.status || "").toLowerCase());

    if (!shouldAutoGenerateQR) {
      return;
    }

    setAutoPairRequested(true);
    void handleStartQRPairing({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session?.access_token,
    overview,
    autoPairRequested,
    sessionSubmitting,
  ]);

  async function handleConnectExisting() {
    if (!session?.access_token) return;
    try {
      setSessionSubmitting(true);
      setError("");
      setMessage("");
      const payload = await apiRequest<SessionState>("/api/v1/whatsapp/session/connect", {
        method: "POST",
        token: session.access_token,
      });
      setOverview((current) => (current ? { ...current, session: payload } : current));
      setMessage("Permintaan reconnect WhatsApp berhasil dikirim.");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal reconnect session WhatsApp.");
    } finally {
      setSessionSubmitting(false);
    }
  }

  async function handleDisconnect() {
    if (!session?.access_token) return;
    try {
      setSessionSubmitting(true);
      setError("");
      setMessage("");
      const payload = await apiRequest<SessionState>("/api/v1/whatsapp/session/disconnect", {
        method: "POST",
        token: session.access_token,
      });
      setOverview((current) => (current ? { ...current, session: payload } : current));
      setMessage("Session WhatsApp berhasil diputus dari BARBERA.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memutus session WhatsApp.");
    } finally {
      setSessionSubmitting(false);
    }
  }

  async function handleSendTest() {
    if (!session?.access_token || !testPhoneNumber) return;
    try {
      setSessionSubmitting(true);
      setError("");
      setMessage("");
      const payload = await apiRequest<SessionState>("/api/v1/whatsapp/session/send-test", {
        method: "POST",
        token: session.access_token,
        body: {
          phone_number: testPhoneNumber,
          message: testMessage,
        },
      });
      setOverview((current) => (current ? { ...current, session: payload } : current));
      setMessage("Pesan uji WhatsApp berhasil dikirim.");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal mengirim pesan uji WhatsApp.");
    } finally {
      setSessionSubmitting(false);
    }
  }

  async function handleSaveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token || !overview) return;
    try {
      setSavingConfig(true);
      setError("");
      setMessage("");
      const payload = await apiRequest<WhatsAppConfig>("/api/v1/whatsapp/config", {
        method: "PUT",
        token: session.access_token,
        body: overview.config,
      });
      setOverview((current) => (current ? { ...current, config: payload } : current));
      setMessage("Konfigurasi WhatsApp owner berhasil disimpan.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal menyimpan konfigurasi WhatsApp.");
    } finally {
      setSavingConfig(false);
    }
  }

  return (
    <TenantPageFrame
      session={session}
      active="whatsapp"
      title="WhatsApp Owner Tools"
      description="Owner bisa mengelola shift, antrean, dan customer lewat command WhatsApp. Semua command tercatat sebagai log operasional tenant."
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <article className="rounded-2xl border border-[#F0EDE8] bg-[#FCFBFA] p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Setup cepat 5 menit</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              "1. Klik Generate QR lalu scan dari menu Perangkat Tertaut di WhatsApp.",
              "2. Setelah connected, aktifkan command owner dan simpan nama owner.",
              "3. Kirim HELP ke chat Message Yourself di WhatsApp yang sama.",
              "4. Mulai atur shift, antrean, dan cek status langsung dari WhatsApp.",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#1A1A1A]">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[#6B6B6B]">
            Android notification forwarder tidak dibutuhkan untuk setup owner. Fitur itu hanya dipakai untuk auto-konfirmasi payment QRIS pribadi Anda.
          </p>
        </article>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Session WhatsApp live</h2>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Hubungkan WhatsApp bisnis/owner dengan QR scan, lalu owner bisa kirim command dari chat Message Yourself tanpa perlu laptop.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Status</p>
                <strong className="mt-2 block text-xl font-extrabold text-[#1A1A1A]">
                  {overview?.session.status || "disconnected"}
                </strong>
                <p className="mt-1 text-xs text-[#6B6B6B]">
                  {overview?.session.is_connected ? "Websocket connected" : "Belum terhubung"}
                  {overview?.session.is_logged_in ? " • Sudah login" : ""}
                </p>
              </div>
              <div className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">Device</p>
                <strong className="mt-2 block text-sm font-bold text-[#1A1A1A] break-all">
                  {overview?.session.device_jid || "-"}
                </strong>
                <p className="mt-1 text-xs text-[#6B6B6B]">
                  {overview?.session.business_name || overview?.session.phone_number || "Belum ada device tertaut"}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleStartQRPairing()}
                  disabled={sessionSubmitting}
                  className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {sessionSubmitting ? "Memproses..." : "Generate QR Pairing"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleConnectExisting()}
                  disabled={sessionSubmitting}
                  className="rounded-xl border border-[#1A1A1A] px-4 py-3 text-sm font-bold text-[#1A1A1A] disabled:opacity-60"
                >
                  Reconnect Session
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  disabled={sessionSubmitting}
                  className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 disabled:opacity-60"
                >
                  Putuskan Session
                </button>
              </div>
            </div>
            {qrPreview ? (
              <div className="mt-5 rounded-2xl border border-[#F0EDE8] bg-[#FCFBFA] p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">QR Pairing</p>
                <div className="mt-3 flex justify-center rounded-2xl border border-[#E5E5E5] bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrPreview} alt="QR pairing WhatsApp" className="h-72 w-72 rounded-xl" />
                </div>
                <p className="mt-2 text-sm text-[#6B6B6B]">
                  Berlaku sampai {overview?.session.pairing_expires_at ? formatDate(overview.session.pairing_expires_at) : "-"}.
                  Buka WhatsApp di HP, masuk ke menu <strong>Perangkat Tertaut</strong>, lalu scan QR ini.
                </p>
              </div>
            ) : null}
            {overview?.session.last_error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {overview.session.last_error}
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Kirim pesan uji</h2>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Pastikan session sudah connected, lalu kirim pesan uji untuk mengecek nomor tenant bisa dipakai live.
            </p>
            <div className="mt-4 space-y-3">
              <input
                value={testPhoneNumber}
                onChange={(event) => setTestPhoneNumber(event.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Nomor tujuan pesan uji"
              />
              <textarea
                rows={4}
                value={testMessage}
                onChange={(event) => setTestMessage(event.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Pesan uji"
              />
              <button
                type="button"
                onClick={() => void handleSendTest()}
                disabled={sessionSubmitting}
                className="rounded-xl bg-[#C8A464] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {sessionSubmitting ? "Mengirim..." : "Kirim Pesan Uji"}
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] px-4 py-3 text-sm text-[#6B6B6B]">
                <div className="font-semibold text-[#1A1A1A]">Terakhir connected</div>
                {overview?.session.last_connected_at ? formatDate(overview.session.last_connected_at) : "-"}
              </div>
              <div className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] px-4 py-3 text-sm text-[#6B6B6B]">
                <div className="font-semibold text-[#1A1A1A]">Terakhir kirim pesan</div>
                {overview?.session.last_message_at ? formatDate(overview.session.last_message_at) : "-"}
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Command Center</h2>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Gunakan modul ini untuk mensimulasikan command yang nanti juga bisa dikirim owner langsung dari WhatsApp yang sudah terhubung.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {overview?.command_catalog.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCommand(item)}
                  className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] px-3 py-3 text-left text-sm text-[#1A1A1A]"
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <textarea
                rows={4}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
              />
              <button
                type="button"
                onClick={() => void handleExecute()}
                disabled={executing}
                className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {executing ? "Menjalankan..." : "Jalankan Command Owner"}
              </button>
            </div>
            {commandResult ? (
              <pre className="mt-4 rounded-xl bg-[#FCFBFA] p-4 text-sm text-[#1A1A1A] whitespace-pre-wrap">
                {commandResult}
              </pre>
            ) : null}
          </article>

          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Konfigurasi owner WhatsApp</h2>
            <form className="mt-4 space-y-4" onSubmit={handleSaveConfig}>
              <input
                value={overview?.config.linked_name ?? ""}
                onChange={(event) =>
                  setOverview((current) =>
                    current ? { ...current, config: { ...current.config, linked_name: event.target.value } } : current,
                  )
                }
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Nama tampilan nomor owner"
              />
              <input
                value={overview?.config.linked_number ?? ""}
                onChange={(event) =>
                  setOverview((current) =>
                    current ? { ...current, config: { ...current.config, linked_number: event.target.value } } : current,
                  )
                }
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Nomor owner opsional bila command dikirim dari nomor berbeda"
              />
              <textarea
                rows={3}
                value={overview?.config.default_queue_message ?? ""}
                onChange={(event) =>
                  setOverview((current) =>
                    current
                      ? { ...current, config: { ...current.config, default_queue_message: event.target.value } }
                      : current,
                  )
                }
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Template pesan link antrean"
              />
              <textarea
                rows={2}
                value={overview?.config.default_reminder_footer ?? ""}
                onChange={(event) =>
                  setOverview((current) =>
                    current
                      ? { ...current, config: { ...current.config, default_reminder_footer: event.target.value } }
                      : current,
                  )
                }
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Footer command owner"
              />
              <label className="flex items-center gap-3 text-sm text-[#6B6B6B]">
                <input
                  type="checkbox"
                  checked={Boolean(overview?.config.owner_commands_enabled)}
                  onChange={(event) =>
                    setOverview((current) =>
                      current
                        ? { ...current, config: { ...current.config, owner_commands_enabled: event.target.checked } }
                        : current,
                    )
                  }
                />
                Aktifkan command owner via WhatsApp
              </label>
              <div className="rounded-xl border border-[#F0EDE8] bg-[#FCFBFA] px-4 py-3 text-sm text-[#6B6B6B]">
                Default termudah:
                <div className="mt-1 text-[#1A1A1A]">
                  Scan QR, lalu kirim command seperti <strong>HELP</strong> atau <strong>QUEUE STATUS</strong> ke chat Message Yourself pada WhatsApp yang sudah terhubung.
                </div>
              </div>
              <button
                type="submit"
                disabled={savingConfig}
                className="rounded-xl bg-[#C8A464] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {savingConfig ? "Menyimpan..." : "Simpan Konfigurasi WhatsApp"}
              </button>
            </form>
          </article>
        </section>

        <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#F0EDE8] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Log command owner</h2>
          </div>
          <div className="divide-y divide-[#F0EDE8]">
            {overview?.recent_logs.map((log) => (
              <div key={log.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#1A1A1A]">{log.command_text}</p>
                    <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">
                      {log.action || "command"} • {log.status} • {log.source}
                    </p>
                    <p className="mt-2 text-sm text-[#6B6B6B] whitespace-pre-wrap">{log.output_text}</p>
                  </div>
                  <span className="text-xs text-[#A3A3A3]">{formatDate(log.created_at)}</span>
                </div>
              </div>
            ))}
            {(overview?.recent_logs.length ?? 0) === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[#A3A3A3]">
                Belum ada command owner yang dijalankan.
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </TenantPageFrame>
  );
}
