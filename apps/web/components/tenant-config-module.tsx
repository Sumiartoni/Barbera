"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { useTenantSession } from "./use-tenant-session";

type ConfigKind = "settings" | "integrations";

const SETTINGS_FIELDS = [
  { key: "business_display_name", label: "Nama tampilan barbershop", placeholder: "BARBERA Studio Ciputat" },
  { key: "business_phone", label: "Nomor kontak toko", placeholder: "081234567890" },
  { key: "business_email", label: "Email operasional", placeholder: "owner@barbershop.com" },
  { key: "business_address", label: "Alamat usaha", placeholder: "Jl. Veteran No. 10, Ciputat" },
  { key: "city", label: "Kota", placeholder: "Tangerang Selatan" },
  { key: "timezone", label: "Timezone", placeholder: "Asia/Jakarta" },
  { key: "opening_hours", label: "Jam operasional", placeholder: "10:00 - 21:00" },
  { key: "booking_window_days", label: "Window booking (hari)", placeholder: "14" },
  { key: "booking_buffer_minutes", label: "Buffer booking (menit)", placeholder: "10" },
  { key: "grace_period_minutes", label: "Toleransi keterlambatan (menit)", placeholder: "10" },
  { key: "queue_display_note", label: "Catatan antrean publik", placeholder: "Datang 10 menit sebelum giliran." },
  { key: "welcome_message", label: "Pesan sambutan", placeholder: "Selamat datang di barbershop kami." },
  { key: "booking_notes", label: "Catatan booking", placeholder: "Mohon datang sesuai jadwal." },
  { key: "late_policy", label: "Kebijakan keterlambatan", placeholder: "Toleransi 10 menit." },
  { key: "reschedule_policy", label: "Kebijakan reschedule", placeholder: "Bisa pindah jadwal maksimal H-1." },
  { key: "queue_call_message", label: "Template panggil antrean", placeholder: "Nomor {{queue_number}} silakan menuju kursi {{station_name}}." },
  { key: "google_review_url", label: "Link Google review", placeholder: "https://g.page/r/xxxx/review" },
  { key: "instagram_handle", label: "Instagram", placeholder: "@barbera.ciputat" },
];

const INTEGRATION_FIELDS = [
  { key: "public_queue_enabled", label: "Public queue aktif", placeholder: "true" },
  { key: "public_queue_domain", label: "Domain antrean publik", placeholder: "https://barbera.my.id/q/tenant-id" },
  { key: "android_forwarder_url", label: "Webhook notification forwarder", placeholder: "https://example.com/notify" },
  { key: "android_forwarder_secret", label: "Secret Android forwarder", placeholder: "forwarder-secret" },
  { key: "owner_command_webhook_url", label: "Webhook command owner", placeholder: "https://api.barbera.my.id/api/v1/public/whatsapp/owner-command/tenant-id" },
  { key: "qris_label", label: "Label QRIS owner", placeholder: "QRIS Utama Owner" },
  { key: "qris_callback_phone", label: "Nomor HP penerima notif", placeholder: "081234567890" },
  { key: "webhook_url", label: "Webhook eksternal", placeholder: "https://example.com/barbera-webhook" },
  { key: "webhook_events", label: "Event webhook", placeholder: "queue.created,payment.paid,shift.updated" },
  { key: "google_calendar_enabled", label: "Sinkron Google Calendar", placeholder: "false" },
  { key: "meta_ads_pixel_id", label: "Meta Pixel ID", placeholder: "123456789012345" },
  { key: "maps_url", label: "Link Google Maps", placeholder: "https://maps.app.goo.gl/..." },
];

export function TenantConfigModule({ kind }: { kind: ConfigKind }) {
  const session = useTenantSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const fields = kind === "settings" ? SETTINGS_FIELDS : INTEGRATION_FIELDS;

  useEffect(() => {
    if (!session?.access_token) return;
    void (async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await apiRequest<{ config: Record<string, unknown> }>(`/api/v1/config/${kind}`, {
          token: session.access_token,
        });
        setValues(
          Object.fromEntries(fields.map((field) => [field.key, String(payload.config?.[field.key] ?? "")])),
        );
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Gagal memuat konfigurasi tenant.");
      } finally {
        setLoading(false);
      }
    })();
  }, [fields, kind, session?.access_token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiRequest(`/api/v1/config/${kind}`, {
        method: "PUT",
        token: session.access_token,
        body: {
          config: Object.fromEntries(fields.map((field) => [field.key, values[field.key] ?? ""])),
        },
      });
      setMessage("Konfigurasi tenant berhasil disimpan.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal menyimpan konfigurasi tenant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Memuat konfigurasi {kind}...
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

      <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#1A1A1A]">
          {kind === "settings" ? "Business settings tenant" : "Integrasi operasional tenant"}
        </h2>
        <p className="mt-1 text-sm text-[#6B6B6B]">
          {kind === "settings"
            ? "Lengkapi profil usaha, aturan antrean, dan kebijakan operasional agar panel tenant layak dipakai komersial."
            : "Hubungkan public queue, webhook Android notification forwarder, dan data operasional lain yang dipakai tenant."}
        </p>
        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          {fields.map((field) => (
            <label key={field.key} className="space-y-2">
              <span className="text-sm font-medium text-[#1A1A1A]">{field.label}</span>
              <input
                value={values[field.key] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder={field.placeholder}
              />
            </label>
          ))}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}
