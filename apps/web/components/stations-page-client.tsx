"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { TenantPageFrame } from "./tenant-page-frame";
import { useTenantSession } from "./use-tenant-session";

type StationRecord = {
  id: string;
  name: string;
  status: string;
};

export function StationsPageClient() {
  const session = useTenantSession();
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");

  async function loadData() {
    if (!session?.access_token) return;
    try {
      setError("");
      const response = await apiRequest<{ stations: StationRecord[] }>("/api/v1/stations", {
        token: session.access_token,
      });
      setStations(response.stations);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memuat kursi aktif.");
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;
    try {
      setSaving(true);
      setError("");
      await apiRequest(editingId ? `/api/v1/stations/${editingId}` : "/api/v1/stations", {
        method: editingId ? "PUT" : "POST",
        token: session.access_token,
        body: { name, status },
      });
      setName("");
      setStatus("active");
      setEditingId("");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal menambahkan kursi.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(station: StationRecord) {
    setEditingId(station.id);
    setName(station.name);
    setStatus(station.status ?? "active");
  }

  function resetForm() {
    setEditingId("");
    setName("");
    setStatus("active");
  }

  return (
    <TenantPageFrame
      session={session}
      active="stations"
      title="Kursi / Station"
      description="Tetapkan jumlah kursi aktif yang benar-benar tersedia untuk melayani antrean."
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <article className="bg-white border border-[#F0EDE8] rounded-2xl p-6 shadow-sm">
          <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleCreate}>
            <input
              required
              className="flex-1 rounded-xl border border-[#E5E5E5] px-4 py-3"
              placeholder="Contoh: Kursi 1"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <select
              className="rounded-xl border border-[#E5E5E5] px-4 py-3 bg-white"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
            >
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Kursi"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm font-bold text-[#6B6B6B]"
              >
                Batal
              </button>
            ) : null}
          </form>
        </article>

        <article className="bg-white border border-[#F0EDE8] rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-[#F0EDE8] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Daftar kursi aktif</h2>
          </div>
          <div className="divide-y divide-[#F0EDE8]">
            {stations.map((station) => (
              <div key={station.id} className="px-6 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#1A1A1A]">{station.name}</p>
                  <p className="text-sm text-[#6B6B6B]">{station.status}</p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(station)}
                  className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-xs font-bold text-[#1A1A1A]"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </article>
      </div>
    </TenantPageFrame>
  );
}
