"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { TenantPageFrame } from "./tenant-page-frame";
import { formatDate, formatIDR } from "./tenant-utils";
import { useTenantSession } from "./use-tenant-session";

type CustomerRecord = {
  id: string;
  full_name: string;
  phone_number: string;
  preferred_barber_id?: string;
  preferred_barber_name?: string;
  preferred_barber: string;
  notes: string;
  total_visits: number;
  total_spent_idr: number;
  last_visit_at?: string;
};

type BarberRecord = {
  id: string;
  full_name: string;
};

export function CustomersPageClient() {
  const session = useTenantSession();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [barbers, setBarbers] = useState<BarberRecord[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    preferred_barber_id: "",
    notes: "",
  });

  async function loadData(search = "") {
    if (!session?.access_token) {
      return;
    }

    try {
      setError("");
      const [customerResponse, barberResponse] = await Promise.all([
        apiRequest<{ customers: CustomerRecord[] }>(
          `/api/v1/customers?limit=25&q=${encodeURIComponent(search)}`,
          { token: session.access_token },
        ),
        apiRequest<{ barbers: BarberRecord[] }>("/api/v1/barbers", {
          token: session.access_token,
        }),
      ]);
      setCustomers(customerResponse.customers);
      setBarbers(barberResponse.barbers);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memuat pelanggan CRM.",
      );
    }
  }

  useEffect(() => {
    void loadData(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, session?.access_token]);

  async function handleCreateCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      await apiRequest(editingId ? `/api/v1/customers/${editingId}` : "/api/v1/customers", {
        method: editingId ? "PUT" : "POST",
        token: session.access_token,
        body: form,
      });
      setForm({
        full_name: "",
        phone_number: "",
        preferred_barber_id: "",
        notes: "",
      });
      setEditingId("");
      await loadData(query);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menambahkan pelanggan.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(customer: CustomerRecord) {
    setEditingId(customer.id);
    setForm({
      full_name: customer.full_name,
      phone_number: customer.phone_number,
      preferred_barber_id: customer.preferred_barber_id ?? "",
      notes: customer.notes ?? "",
    });
  }

  function resetForm() {
    setEditingId("");
    setForm({
      full_name: "",
      phone_number: "",
      preferred_barber_id: "",
      notes: "",
    });
  }

  return (
    <TenantPageFrame
      session={session}
      active="customers"
      title="Pelanggan CRM"
      description="Kelola data pelanggan, barber favorit, dan riwayat repeat customer dari tenant Anda."
    >
      <div className="space-y-6">
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <section className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
              <article className="bg-white border border-[#F0EDE8] rounded-2xl p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-[#1A1A1A]">
                    {editingId ? "Edit pelanggan" : "Tambah pelanggan"}
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
                <form className="space-y-4" onSubmit={handleCreateCustomer}>
                  <input
                    required
                    className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                    placeholder="Nama pelanggan"
                    value={form.full_name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, full_name: event.target.value }))
                    }
                  />
                  <input
                    required
                    className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                    placeholder="Nomor WhatsApp"
                    value={form.phone_number}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone_number: event.target.value }))
                    }
                  />
                  <select
                    className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 bg-white"
                    value={form.preferred_barber_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        preferred_barber_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Barber favorit (opsional)</option>
                    {barbers.map((barber) => (
                      <option key={barber.id} value={barber.id}>
                        {barber.full_name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                    placeholder="Catatan preferensi pelanggan"
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
                  >
                    {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Pelanggan"}
                  </button>
                </form>
              </article>

              <article className="bg-white border border-[#F0EDE8] rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-[#F0EDE8] px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#1A1A1A]">Daftar pelanggan</h2>
                    <p className="text-sm text-[#6B6B6B]">Cari berdasarkan nama, WhatsApp, atau barber favorit.</p>
                  </div>
                  <input
                    className="rounded-xl border border-[#E5E5E5] px-4 py-2.5 text-sm"
                    placeholder="Cari pelanggan..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#FCFBFA] text-xs uppercase tracking-wider text-[#A3A3A3]">
                      <tr>
                        <th className="px-4 py-3">Pelanggan</th>
                        <th className="px-4 py-3">Barber favorit</th>
                        <th className="px-4 py-3">Riwayat</th>
                        <th className="px-4 py-3">Total spend</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer) => (
                        <tr key={customer.id} className="border-t border-[#F0EDE8] align-top">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-[#1A1A1A]">{customer.full_name}</p>
                            <p className="text-sm text-[#6B6B6B]">{customer.phone_number}</p>
                            {customer.notes ? (
                              <p className="text-xs text-[#A3A3A3] mt-1">{customer.notes}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#1A1A1A]">
                            {customer.preferred_barber_name || customer.preferred_barber || "-"}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#6B6B6B]">
                            <p>{customer.total_visits} kunjungan</p>
                            <p className="text-xs text-[#A3A3A3]">
                              Terakhir: {formatDate(customer.last_visit_at)}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-[#1A1A1A]">
                            {formatIDR(customer.total_spent_idr)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => startEdit(customer)}
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
