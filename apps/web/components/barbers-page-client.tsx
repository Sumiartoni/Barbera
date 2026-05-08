"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { TenantPageFrame } from "./tenant-page-frame";
import { formatDate } from "./tenant-utils";
import { useTenantSession } from "./use-tenant-session";

type BarberRecord = {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  on_shift: boolean;
  sort_order: number;
};

type AccessAccount = {
  id: string;
  barber_id: string;
  barber_name: string;
  access_code: string;
  status: string;
  last_login_at?: string;
};

export function BarbersPageClient() {
  const session = useTenantSession();
  const [barbers, setBarbers] = useState<BarberRecord[]>([]);
  const [accounts, setAccounts] = useState<AccessAccount[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [provisioningId, setProvisioningId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    sort_order: "0",
    status: "active",
  });
  const [pins, setPins] = useState<Record<string, string>>({});

  async function loadData() {
    if (!session?.access_token) {
      return;
    }

    try {
      setError("");
      const [barberResponse, accountResponse] = await Promise.all([
        apiRequest<{ barbers: BarberRecord[] }>("/api/v1/barbers", {
          token: session.access_token,
        }),
        apiRequest<{ accounts: AccessAccount[] }>("/api/v1/barber-access", {
          token: session.access_token,
        }),
      ]);
      setBarbers(barberResponse.barbers);
      setAccounts(accountResponse.accounts);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memuat data barber.",
      );
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function handleCreateBarber(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) {
      return;
    }

    try {
      setCreating(true);
      setError("");
      await apiRequest(editingId ? `/api/v1/barbers/${editingId}` : "/api/v1/barbers", {
        method: editingId ? "PUT" : "POST",
        token: session.access_token,
        body: {
          full_name: form.full_name,
          phone_number: form.phone_number,
          sort_order: Number(form.sort_order || 0),
          status: form.status,
        },
      });
      setForm({ full_name: "", phone_number: "", sort_order: "0", status: "active" });
      setEditingId("");
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menambahkan barber.",
      );
    } finally {
      setCreating(false);
    }
  }

  function startEdit(barber: BarberRecord) {
    setEditingId(barber.id);
    setForm({
      full_name: barber.full_name,
      phone_number: barber.phone_number ?? "",
      sort_order: String(barber.sort_order ?? 0),
      status: barber.status ?? "active",
    });
  }

  function resetForm() {
    setEditingId("");
    setForm({ full_name: "", phone_number: "", sort_order: "0", status: "active" });
  }

  async function handleProvisionAccess(barberId: string) {
    if (!session?.access_token) {
      return;
    }
    const pin = pins[barberId]?.trim();
    if (!pin || pin.length < 4) {
      setError("PIN barber minimal 4 digit.");
      return;
    }

    try {
      setProvisioningId(barberId);
      setError("");
      await apiRequest("/api/v1/barber-access", {
        method: "POST",
        token: session.access_token,
        body: {
          barber_id: barberId,
          pin,
        },
      });
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal membuat akses barber.",
      );
    } finally {
      setProvisioningId("");
    }
  }

  function accountForBarber(barberId: string) {
    return accounts.find((account) => account.barber_id === barberId) ?? null;
  }

  return (
    <TenantPageFrame
      session={session}
      active="barbers"
      title="Barber & Akses POS"
      description="Kelola barber aktif, status shift, serta kode akses dan PIN untuk login POS masing-masing barber."
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <article className="bg-white border border-[#F0EDE8] rounded-2xl p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#1A1A1A]">
                {editingId ? "Edit barber" : "Tambah barber"}
              </h2>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-xs font-bold text-[#6B6B6B]"
                >
                  Batal
                </button>
              ) : null}
            </div>
            <form className="space-y-4" onSubmit={handleCreateBarber}>
              <input
                required
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Nama barber"
                value={form.full_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, full_name: event.target.value }))
                }
              />
              <input
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Nomor WhatsApp barber"
                value={form.phone_number}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone_number: event.target.value }))
                }
              />
              <input
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Urutan tampil"
                value={form.sort_order}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sort_order: event.target.value }))
                }
              />
              <select
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 bg-white"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
              >
                {creating ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Barber"}
              </button>
            </form>
          </article>

          <article className="bg-white border border-[#F0EDE8] rounded-2xl shadow-sm overflow-hidden">
            <div className="border-b border-[#F0EDE8] px-6 py-4">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Daftar barber aktif</h2>
              <p className="text-sm text-[#6B6B6B]">
                Atur PIN login POS untuk setiap barber secara terpisah.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
                      <tr>
                        <th className="px-4 py-3">Barber</th>
                        <th className="px-4 py-3">Shift</th>
                        <th className="px-4 py-3">Akses POS</th>
                        <th className="px-4 py-3">PIN baru</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                <tbody>
                  {barbers.map((barber) => {
                    const account = accountForBarber(barber.id);
                    return (
                      <tr key={barber.id} className="border-t border-[#F0EDE8] align-top">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-[#1A1A1A]">{barber.full_name}</p>
                          <p className="text-sm text-[#6B6B6B]">{barber.phone_number || "-"}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              barber.on_shift
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-[#F5F5F5] text-[#6B6B6B]"
                            }`}
                          >
                            {barber.on_shift ? "Sedang shift" : "Belum shift"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#1A1A1A]">
                          {account ? (
                            <div className="space-y-1">
                              <p className="font-semibold">{account.access_code}</p>
                              <p className="text-xs text-[#6B6B6B]">
                                Login terakhir: {formatDate(account.last_login_at)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-[#A3A3A3]">Belum dibuat</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <input
                              className="w-full rounded-xl border border-[#E5E5E5] px-3 py-2"
                              placeholder="PIN 4+ digit"
                              value={pins[barber.id] ?? ""}
                              onChange={(event) =>
                                setPins((current) => ({
                                  ...current,
                                  [barber.id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() => void handleProvisionAccess(barber.id)}
                              disabled={provisioningId === barber.id}
                              className="rounded-xl bg-[#C8A464] px-4 py-2 text-xs font-bold text-white disabled:opacity-70"
                            >
                              {provisioningId === barber.id ? "..." : account ? "Reset" : "Buat"}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(barber)}
                            className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-xs font-bold text-[#1A1A1A]"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </TenantPageFrame>
  );
}
