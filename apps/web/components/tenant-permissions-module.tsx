"use client";

import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "../lib/api";
import { useTenantSession } from "./use-tenant-session";

type PermissionKey =
  | "dashboard"
  | "customers"
  | "visits"
  | "queue"
  | "barbers"
  | "shifts"
  | "billing"
  | "whatsapp"
  | "reports"
  | "settings";

type RoleKey = "owner" | "admin" | "cashier" | "barber";

type PermissionMatrix = Record<RoleKey, Record<PermissionKey, boolean>>;

const permissionLabels: Array<{ key: PermissionKey; label: string; hint: string }> = [
  { key: "dashboard", label: "Dashboard", hint: "Ikhtisar, KPI, retention." },
  { key: "customers", label: "CRM Pelanggan", hint: "Data pelanggan dan histori." },
  { key: "visits", label: "Kunjungan", hint: "Riwayat layanan dan transaksi." },
  { key: "queue", label: "Antrian / POS", hint: "Antrean live dan front desk." },
  { key: "barbers", label: "Barber & Outlet", hint: "Barber, station, outlet." },
  { key: "shifts", label: "Shift", hint: "Atur jadwal kerja barber." },
  { key: "billing", label: "Billing", hint: "Paket, upgrade, riwayat order." },
  { key: "whatsapp", label: "WhatsApp", hint: "Command owner dan konfigurasi WA." },
  { key: "reports", label: "Reports", hint: "Laporan, omzet, retention." },
  { key: "settings", label: "Settings", hint: "Integrations dan pengaturan tenant." },
];

const roleLabels: Record<RoleKey, string> = {
  owner: "Owner",
  admin: "Admin",
  cashier: "Cashier",
  barber: "Barber",
};

function createDefaultMatrix(): PermissionMatrix {
  return {
    owner: {
      dashboard: true,
      customers: true,
      visits: true,
      queue: true,
      barbers: true,
      shifts: true,
      billing: true,
      whatsapp: true,
      reports: true,
      settings: true,
    },
    admin: {
      dashboard: true,
      customers: true,
      visits: true,
      queue: true,
      barbers: true,
      shifts: true,
      billing: false,
      whatsapp: true,
      reports: true,
      settings: false,
    },
    cashier: {
      dashboard: true,
      customers: true,
      visits: true,
      queue: true,
      barbers: false,
      shifts: false,
      billing: false,
      whatsapp: false,
      reports: false,
      settings: false,
    },
    barber: {
      dashboard: false,
      customers: false,
      visits: false,
      queue: true,
      barbers: false,
      shifts: true,
      billing: false,
      whatsapp: false,
      reports: false,
      settings: false,
    },
  };
}

function normalizeMatrix(raw: Record<string, unknown> | null | undefined): PermissionMatrix {
  const defaults = createDefaultMatrix();
  if (!raw) {
    return defaults;
  }

  const next = createDefaultMatrix();
  for (const role of Object.keys(next) as RoleKey[]) {
    const rawRole = raw[role];
    if (!rawRole || typeof rawRole !== "object") {
      continue;
    }
    for (const permission of permissionLabels) {
      const value = (rawRole as Record<string, unknown>)[permission.key];
      if (typeof value === "boolean") {
        next[role][permission.key] = value;
      }
    }
  }
  return next;
}

export function TenantPermissionsModule() {
  const session = useTenantSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [matrix, setMatrix] = useState<PermissionMatrix>(createDefaultMatrix());

  const totals = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(matrix) as RoleKey[]).map((role) => [
          role,
          Object.values(matrix[role]).filter(Boolean).length,
        ]),
      ) as Record<RoleKey, number>,
    [matrix],
  );

  useEffect(() => {
    if (!session?.access_token) return;
    void (async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await apiRequest<{ config: Record<string, unknown> }>("/api/v1/config/permissions", {
          token: session.access_token,
        });
        setMatrix(normalizeMatrix(payload.config));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Gagal memuat permission tenant.");
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.access_token]);

  async function handleSave() {
    if (!session?.access_token) return;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiRequest("/api/v1/config/permissions", {
        method: "PUT",
        token: session.access_token,
        body: {
          config: matrix,
        },
      });
      setMessage("Permission role tenant berhasil disimpan.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal menyimpan permission tenant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Memuat matriks permission tenant...
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

      <section className="grid gap-4 md:grid-cols-4">
        {(Object.keys(roleLabels) as RoleKey[]).map((role) => (
          <article key={role} className="rounded-2xl border border-[#F0EDE8] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">{roleLabels[role]}</p>
            <strong className="mt-2 block text-2xl font-extrabold text-[#1A1A1A]">{totals[role]}</strong>
            <p className="mt-1 text-sm text-[#6B6B6B]">menu aktif yang diizinkan</p>
          </article>
        ))}
      </section>

      <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-[#F0EDE8] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1A1A1A]">Matriks permission role</h2>
            <p className="text-sm text-[#6B6B6B]">
              Owner bisa menentukan modul apa saja yang terlihat dan dipakai per role tenant.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan Permission"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
              <tr>
                <th className="px-4 py-3">Modul</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Cashier</th>
                <th className="px-4 py-3">Barber</th>
              </tr>
            </thead>
            <tbody>
              {permissionLabels.map((permission) => (
                <tr key={permission.key} className="border-t border-[#F0EDE8]">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-[#1A1A1A]">{permission.label}</p>
                    <p className="text-xs text-[#6B6B6B]">{permission.hint}</p>
                  </td>
                  {(Object.keys(roleLabels) as RoleKey[]).map((role) => (
                    <td key={role} className="px-4 py-4">
                      <label className="inline-flex items-center gap-2 text-sm text-[#6B6B6B]">
                        <input
                          type="checkbox"
                          checked={Boolean(matrix[role][permission.key])}
                          disabled={role === "owner"}
                          onChange={(event) =>
                            setMatrix((current) => ({
                              ...current,
                              [role]: {
                                ...current[role],
                                [permission.key]: event.target.checked,
                              },
                            }))
                          }
                        />
                        {role === "owner" ? "Tetap aktif" : matrix[role][permission.key] ? "Diizinkan" : "Diblok"}
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
