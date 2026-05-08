"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { TenantPageFrame } from "./tenant-page-frame";
import { formatDate } from "./tenant-utils";
import { useTenantSession } from "./use-tenant-session";

type BarberRecord = {
  id: string;
  full_name: string;
};

type ShiftRecord = {
  id: string;
  barber_id: string;
  barber_name: string;
  starts_at: string;
  ends_at: string;
  source: string;
  status: string;
  notes: string;
};

export function ShiftsPageClient() {
  const session = useTenantSession();
  const [barbers, setBarbers] = useState<BarberRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    barber_id: "",
    date: new Date().toISOString().slice(0, 10),
    start: "09:00",
    end: "17:00",
    status: "scheduled",
    notes: "",
  });

  async function loadData(date = form.date) {
    if (!session?.access_token) return;
    try {
      setError("");
      const [barberResponse, shiftResponse] = await Promise.all([
        apiRequest<{ barbers: BarberRecord[] }>("/api/v1/barbers", {
          token: session.access_token,
        }),
        apiRequest<{ shifts: ShiftRecord[] }>(`/api/v1/shifts?day=${encodeURIComponent(date)}`, {
          token: session.access_token,
        }),
      ]);
      setBarbers(barberResponse.barbers);
      setShifts(shiftResponse.shifts);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memuat jadwal shift.");
    }
  }

  useEffect(() => {
    void loadData(form.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, form.date]);

  async function handleCreateShift(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;
    try {
      setSaving(true);
      setError("");
      await apiRequest(editingId ? `/api/v1/shifts/${editingId}` : "/api/v1/shifts", {
        method: editingId ? "PUT" : "POST",
        token: session.access_token,
        body: {
          barber_id: form.barber_id,
          starts_at: new Date(`${form.date}T${form.start}:00+07:00`).toISOString(),
          ends_at: new Date(`${form.date}T${form.end}:00+07:00`).toISOString(),
          status: form.status,
          notes: form.notes,
        },
      });
      setEditingId("");
      setForm((current) => ({
        ...current,
        barber_id: "",
        start: "09:00",
        end: "17:00",
        status: "scheduled",
        notes: "",
      }));
      await loadData(form.date);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal menambahkan shift.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(shift: ShiftRecord) {
    const startsAt = new Date(shift.starts_at);
    const endsAt = new Date(shift.ends_at);
    setEditingId(shift.id);
    setForm({
      barber_id: shift.barber_id,
      date: shift.starts_at.slice(0, 10),
      start: startsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
      end: endsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
      status: shift.status,
      notes: shift.notes ?? "",
    });
  }

  function resetForm() {
    setEditingId("");
    setForm({
      barber_id: "",
      date: new Date().toISOString().slice(0, 10),
      start: "09:00",
      end: "17:00",
      status: "scheduled",
      notes: "",
    });
  }

  async function handleCancelShift(shift: ShiftRecord) {
    if (!session?.access_token) return;
    try {
      setSaving(true);
      setError("");
      await apiRequest(`/api/v1/shifts/${shift.id}`, {
        method: "PUT",
        token: session.access_token,
        body: {
          barber_id: shift.barber_id,
          starts_at: shift.starts_at,
          ends_at: shift.ends_at,
          notes: shift.notes,
          status: "canceled",
        },
      });
      if (editingId === shift.id) {
        resetForm();
      }
      await loadData(form.date);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal membatalkan shift.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TenantPageFrame
      session={session}
      active="shifts"
      title="Jadwal & Shift"
      description="Atur barber yang masuk shift dari dashboard owner atau lewat command WhatsApp."
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
              <h2 className="text-lg font-bold text-[#1A1A1A]">{editingId ? "Edit shift" : "Tambah shift"}</h2>
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
            <form className="space-y-4" onSubmit={handleCreateShift}>
              <select
                required
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 bg-white"
                value={form.barber_id}
                onChange={(event) => setForm((current) => ({ ...current, barber_id: event.target.value }))}
              >
                <option value="">Pilih barber</option>
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.full_name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  className="rounded-xl border border-[#E5E5E5] px-4 py-3"
                  value={form.start}
                  onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))}
                />
                <input
                  type="time"
                  className="rounded-xl border border-[#E5E5E5] px-4 py-3"
                  value={form.end}
                  onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))}
                />
              </div>
              <select
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 bg-white"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="scheduled">Scheduled</option>
                <option value="canceled">Canceled</option>
              </select>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="Catatan shift atau instruksi khusus"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
              >
                {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Shift"}
              </button>
            </form>
          </article>

          <article className="bg-white border border-[#F0EDE8] rounded-2xl shadow-sm overflow-hidden">
            <div className="border-b border-[#F0EDE8] px-6 py-4">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Shift tanggal {form.date}</h2>
            </div>
            <div className="divide-y divide-[#F0EDE8]">
              {shifts.map((shift) => (
                <div key={shift.id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#1A1A1A]">{shift.barber_name}</p>
                    <p className="text-sm text-[#6B6B6B]">
                      {formatDate(shift.starts_at)} - {formatDate(shift.ends_at)}
                    </p>
                    <p className="text-xs text-[#A3A3A3] mt-1 uppercase">
                      {shift.source} · {shift.status}
                    </p>
                    {shift.notes ? (
                      <p className="text-xs text-[#6B6B6B] mt-2">{shift.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(shift)}
                      className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-xs font-bold text-[#1A1A1A]"
                    >
                      Edit
                    </button>
                    {shift.status !== "canceled" ? (
                      <button
                        type="button"
                        onClick={() => void handleCancelShift(shift)}
                        disabled={saving}
                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-70"
                      >
                        Batalkan
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </TenantPageFrame>
  );
}
