"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { TenantPageFrame } from "./tenant-page-frame";
import { useTenantSession } from "./use-tenant-session";

type OutletRecord = {
  id: string;
  name: string;
  code: string;
  address: string;
  phone_number: string;
  status: string;
  is_primary: boolean;
  created_at: string;
};

type OutletEntitlement = {
  plan_code: string;
  max_outlets: number;
  current_outlets: number;
  allow_multi_outlet: boolean;
  can_create_more: boolean;
};

export function OutletsPageClient() {
  const session = useTenantSession();
  const [outlets, setOutlets] = useState<OutletRecord[]>([]);
  const [entitlement, setEntitlement] = useState<OutletEntitlement | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    phone_number: "",
    status: "active",
  });

  async function loadData() {
    if (!session?.access_token) {
      return;
    }

    try {
      setError("");
      const result = await apiRequest<{
        outlets: OutletRecord[];
        entitlement: OutletEntitlement;
      }>("/api/v1/outlets", {
        token: session.access_token,
      });
      setOutlets(result.outlets);
      setEntitlement(result.entitlement);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memuat data outlet.",
      );
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      await apiRequest<{
        outlet: OutletRecord;
        entitlement: OutletEntitlement;
      }>(editingId ? `/api/v1/outlets/${editingId}` : "/api/v1/outlets", {
        method: editingId ? "PUT" : "POST",
        token: session.access_token,
        body: form,
      });
      await loadData();
      setForm({
        name: "",
        code: "",
        address: "",
        phone_number: "",
        status: "active",
      });
      setEditingId("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menambahkan outlet.",
      );
    } finally {
      setSaving(false);
    }
  }

  const canCreate = entitlement?.can_create_more ?? false;

  function startEdit(outlet: OutletRecord) {
    setEditingId(outlet.id);
    setForm({
      name: outlet.name,
      code: outlet.code ?? "",
      address: outlet.address ?? "",
      phone_number: outlet.phone_number ?? "",
      status: outlet.status ?? "active",
    });
  }

  function resetForm() {
    setEditingId("");
    setForm({
      name: "",
      code: "",
      address: "",
      phone_number: "",
      status: "active",
    });
  }

  return (
    <TenantPageFrame
      session={session}
      active="outlets"
      title="Outlet & Cabang"
      description="Kelola outlet utama dan cabang tambahan. Penambahan outlet mengikuti limit paket BARBERA tenant Anda."
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3] mb-2">Paket aktif</p>
            <strong className="text-2xl font-extrabold text-[#1A1A1A] uppercase">
              {entitlement?.plan_code ?? session?.plan_code ?? "-"}
            </strong>
          </article>
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3] mb-2">Outlet aktif</p>
            <strong className="text-2xl font-extrabold text-[#1A1A1A]">
              {entitlement?.current_outlets ?? 0} / {entitlement?.max_outlets ?? 1}
            </strong>
          </article>
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3] mb-2">Status cabang</p>
            <strong className="text-2xl font-extrabold text-[#1A1A1A]">
              {entitlement?.allow_multi_outlet ? "Multi-outlet aktif" : "Single outlet"}
            </strong>
          </article>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#1A1A1A]">
                {editingId ? "Edit outlet" : "Tambah outlet baru"}
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
            <p className="text-sm text-[#6B6B6B] mb-4">
              Owner pada paket Pro dan Plus dapat menambahkan cabang tambahan sampai limit paket terpenuhi.
            </p>
            <form className="space-y-4" onSubmit={handleCreate}>
              <input
                required
                disabled={!canCreate || saving}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 disabled:bg-[#F5F5F5]"
                placeholder="Nama outlet"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
              <input
                disabled={!canCreate || saving}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 disabled:bg-[#F5F5F5]"
                placeholder="Kode outlet"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
              />
              <textarea
                disabled={!canCreate || saving}
                className="min-h-28 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 disabled:bg-[#F5F5F5]"
                placeholder="Alamat outlet"
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({ ...current, address: event.target.value }))
                }
              />
              <input
                disabled={!canCreate || saving}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 disabled:bg-[#F5F5F5]"
                placeholder="Nomor telepon outlet"
                value={form.phone_number}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone_number: event.target.value }))
                }
              />
              <select
                disabled={saving}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 bg-white disabled:bg-[#F5F5F5]"
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
                disabled={(!canCreate && !editingId) || saving}
                className="w-full rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Outlet"}
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#F0EDE8] px-6 py-4">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Daftar outlet tenant</h2>
              <p className="text-sm text-[#6B6B6B]">
                Semua outlet yang terdaftar di tenant {session?.tenant.name}.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
                  <tr>
                    <th className="px-4 py-3">Outlet</th>
                    <th className="px-4 py-3">Kode</th>
                    <th className="px-4 py-3">Alamat</th>
                    <th className="px-4 py-3">Telepon</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {outlets.map((outlet) => (
                    <tr key={outlet.id} className="border-t border-[#F0EDE8] align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-[#1A1A1A]">{outlet.name}</p>
                        {outlet.is_primary ? (
                          <span className="mt-1 inline-flex rounded-full bg-[#C8A464]/10 px-2 py-1 text-[10px] font-bold uppercase text-[#C8A464]">
                            Outlet utama
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#6B6B6B]">{outlet.code || "-"}</td>
                      <td className="px-4 py-4 text-sm text-[#6B6B6B]">{outlet.address || "-"}</td>
                      <td className="px-4 py-4 text-sm text-[#6B6B6B]">{outlet.phone_number || "-"}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase text-emerald-700">
                          {outlet.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(outlet)}
                          className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-xs font-bold text-[#1A1A1A]"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </TenantPageFrame>
  );
}
