"use client";

import { useState } from "react";
import type { TenantsResponse } from "../lib/platform-types";

type TenantRecord = TenantsResponse["tenants"][number];

const statusOptions = ["active", "pending", "suspended"] as const;

export function TenantStatusManager({
  tenants,
  title,
  description,
  focusTenantID,
}: {
  tenants: TenantRecord[];
  title: string;
  description: string;
  focusTenantID?: string;
}) {
  const [rows, setRows] = useState<TenantRecord[]>(tenants);
  const [selected, setSelected] = useState<Record<string, string>>(
    Object.fromEntries(tenants.map((tenant) => [tenant.id, tenant.status])),
  );
  const [savingTenantID, setSavingTenantID] = useState("");
  const [message, setMessage] = useState<Record<string, string>>({});
  const orderedRows = rows.slice().sort((left, right) => {
    if (focusTenantID) {
      if (left.id === focusTenantID) return -1;
      if (right.id === focusTenantID) return 1;
    }
    return left.name.localeCompare(right.name);
  });

  async function requestJSON(path: string, options: RequestInit) {
    const response = await fetch(path, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error ?? "Gagal memperbarui status tenant.");
    }
    return payload;
  }

  async function handleSave(tenantID: string) {
    try {
      setSavingTenantID(tenantID);
      setMessage((current) => ({ ...current, [tenantID]: "" }));

      await requestJSON(`/api/tenants/${tenantID}/status`, {
        method: "POST",
        body: JSON.stringify({
          status: selected[tenantID],
        }),
      });

      setRows((current) =>
        current.map((tenant) =>
          tenant.id === tenantID ? { ...tenant, status: selected[tenantID] ?? tenant.status } : tenant,
        ),
      );
      setMessage((current) => ({ ...current, [tenantID]: "Status tenant berhasil diperbarui." }));
    } catch (error) {
      setMessage((current) => ({
        ...current,
        [tenantID]: error instanceof Error ? error.message : "Gagal memperbarui status tenant.",
      }));
    } finally {
      setSavingTenantID("");
    }
  }

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="border-b border-zinc-800 p-6">
        <h3 className="text-lg font-bold text-zinc-100">{title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Status saat ini</th>
              <th className="px-4 py-3">Status baru</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {orderedRows.map((tenant) => (
              <tr key={tenant.id} className={focusTenantID === tenant.id ? "bg-zinc-800/30" : undefined}>
                <td className="px-4 py-4">
                  <p className="font-semibold text-zinc-100">{tenant.name}</p>
                  <p className="text-xs text-zinc-500">{tenant.slug}</p>
                  {message[tenant.id] ? (
                    <p className="mt-2 text-xs text-zinc-400">{message[tenant.id]}</p>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-sm uppercase text-zinc-300">{tenant.status}</td>
                <td className="px-4 py-4">
                  <select
                    value={selected[tenant.id] ?? tenant.status}
                    onChange={(event) =>
                      setSelected((current) => ({ ...current, [tenant.id]: event.target.value }))
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-4 text-sm uppercase text-zinc-300">{tenant.plan_code}</td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => void handleSave(tenant.id)}
                    disabled={savingTenantID === tenant.id}
                    className="rounded-xl bg-[#C8A464] px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
                  >
                    {savingTenantID === tenant.id ? "Menyimpan..." : "Update status"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
