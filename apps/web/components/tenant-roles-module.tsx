"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { formatDate } from "./tenant-utils";
import { useTenantSession } from "./use-tenant-session";

type TeamMember = {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone_number: string;
  role: string;
  status: string;
  is_primary: boolean;
  last_login_at?: string;
};

type BarberRecord = {
  id: string;
  full_name: string;
  phone_number: string;
};

type AccessAccount = {
  id: string;
  barber_id: string;
  barber_name: string;
  access_code: string;
  status: string;
  last_login_at?: string;
};

const emptyMemberForm = {
  full_name: "",
  email: "",
  phone_number: "",
  password: "",
  role: "admin",
  status: "active",
};

const emptyAccessForm = {
  barber_id: "",
  pin: "",
  regenerate_code: false,
};

export function TenantRolesModule() {
  const session = useTenantSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [barbers, setBarbers] = useState<BarberRecord[]>([]);
  const [accounts, setAccounts] = useState<AccessAccount[]>([]);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [editingMemberId, setEditingMemberId] = useState("");
  const [accessForm, setAccessForm] = useState(emptyAccessForm);
  const [editingAccessId, setEditingAccessId] = useState("");
  const [accessStatus, setAccessStatus] = useState("active");

  async function loadData() {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      setError("");
      const [membersPayload, barbersPayload, accessPayload] = await Promise.all([
        apiRequest<{ members: TeamMember[] }>("/api/v1/team-members", { token: session.access_token }),
        apiRequest<{ barbers: BarberRecord[] }>("/api/v1/barbers", { token: session.access_token }),
        apiRequest<{ accounts: AccessAccount[] }>("/api/v1/barber-access", { token: session.access_token }),
      ]);
      setMembers(membersPayload.members ?? []);
      setBarbers(barbersPayload.barbers ?? []);
      setAccounts(accessPayload.accounts ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memuat data tim tenant.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function handleMemberSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const payload = editingMemberId
        ? await apiRequest<TeamMember>(`/api/v1/team-members/${editingMemberId}`, {
            method: "PUT",
            token: session.access_token,
            body: {
              full_name: memberForm.full_name,
              phone_number: memberForm.phone_number,
              password: memberForm.password,
              role: memberForm.role,
              status: memberForm.status,
            },
          })
        : await apiRequest<TeamMember>("/api/v1/team-members", {
            method: "POST",
            token: session.access_token,
            body: memberForm,
          });
      if (editingMemberId) {
        setMembers((current) => current.map((item) => (item.membership_id === payload.membership_id ? payload : item)));
        setMessage("Akses tim dashboard berhasil diperbarui.");
      } else {
        setMembers((current) => [payload, ...current]);
        setMessage("Anggota tim dashboard berhasil ditambahkan.");
      }
      setEditingMemberId("");
      setMemberForm(emptyMemberForm);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal menyimpan anggota tim.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAccessSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const payload = editingAccessId
        ? await apiRequest<AccessAccount>(`/api/v1/barber-access/${editingAccessId}`, {
            method: "PUT",
            token: session.access_token,
            body: {
              pin: accessForm.pin,
              status: accessStatus,
              regenerate_code: accessForm.regenerate_code,
            },
          })
        : await apiRequest<AccessAccount>("/api/v1/barber-access", {
            method: "POST",
            token: session.access_token,
            body: accessForm,
          });
      if (editingAccessId) {
        setAccounts((current) => current.map((item) => (item.id === payload.id ? payload : item)));
        setMessage("Akses POS barber berhasil diperbarui.");
      } else {
        setAccounts((current) => [payload, ...current]);
        setMessage("Akses POS barber berhasil dibuat.");
      }
      setEditingAccessId("");
      setAccessStatus("active");
      setAccessForm(emptyAccessForm);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal menyimpan akses barber.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Memuat struktur tim dan akses POS...
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

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#1A1A1A]">{editingMemberId ? "Edit tim dashboard" : "Tambah tim dashboard"}</h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Tambahkan admin atau cashier yang boleh mengakses panel tenant selain owner utama.
          </p>
          <form className="mt-5 space-y-4" onSubmit={handleMemberSubmit}>
            <input
              value={memberForm.full_name}
              onChange={(event) => setMemberForm((current) => ({ ...current, full_name: event.target.value }))}
              className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
              placeholder="Nama lengkap"
              required
            />
            <input
              type="email"
              value={memberForm.email}
              onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
              placeholder="email@barbershop.com"
              required={!editingMemberId}
              disabled={Boolean(editingMemberId)}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={memberForm.phone_number}
                onChange={(event) => setMemberForm((current) => ({ ...current, phone_number: event.target.value }))}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder="08xxxxxxxxxx"
              />
              <select
                value={memberForm.role}
                onChange={(event) => setMemberForm((current) => ({ ...current, role: event.target.value }))}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3"
              >
                <option value="admin">Admin</option>
                <option value="cashier">Cashier</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <select
              value={memberForm.status}
              onChange={(event) => setMemberForm((current) => ({ ...current, status: event.target.value }))}
              className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="pending">Pending</option>
            </select>
            <input
              type="password"
              value={memberForm.password}
              onChange={(event) => setMemberForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
              placeholder={editingMemberId ? "Kosongkan jika tidak ganti password" : "Password minimal 8 karakter"}
              required={!editingMemberId}
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : editingMemberId ? "Simpan Perubahan Tim" : "Tambah Tim Dashboard"}
            </button>
            {editingMemberId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingMemberId("");
                  setMemberForm(emptyMemberForm);
                }}
                className="ml-3 rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm font-semibold text-[#1A1A1A]"
              >
                Batal Edit
              </button>
            ) : null}
          </form>
        </article>

        <article className="rounded-2xl border border-[#F0EDE8] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#1A1A1A]">{editingAccessId ? "Edit akses POS barber" : "Tambah akses POS barber"}</h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Owner bisa memberi PIN berbeda untuk tiap barber yang login lewat website POS atau aplikasi.
          </p>
          <form className="mt-5 space-y-4" onSubmit={handleAccessSubmit}>
            <select
              value={accessForm.barber_id}
              onChange={(event) => setAccessForm((current) => ({ ...current, barber_id: event.target.value }))}
              className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3"
              disabled={Boolean(editingAccessId)}
              required
            >
              <option value="">Pilih barber</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.full_name}
                </option>
              ))}
            </select>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="password"
                value={accessForm.pin}
                onChange={(event) => setAccessForm((current) => ({ ...current, pin: event.target.value }))}
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3"
                placeholder={editingAccessId ? "PIN baru opsional" : "PIN 4 digit atau lebih"}
                required={!editingAccessId}
              />
              <select
                value={accessStatus}
                onChange={(event) => setAccessStatus(event.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3"
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <label className="flex items-center gap-3 text-sm text-[#6B6B6B]">
              <input
                type="checkbox"
                checked={accessForm.regenerate_code}
                onChange={(event) =>
                  setAccessForm((current) => ({ ...current, regenerate_code: event.target.checked }))
                }
              />
              Generate kode akses baru
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#C8A464] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : editingAccessId ? "Simpan Akses POS" : "Buat Akses POS"}
            </button>
            {editingAccessId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingAccessId("");
                  setAccessStatus("active");
                  setAccessForm(emptyAccessForm);
                }}
                className="ml-3 rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm font-semibold text-[#1A1A1A]"
              >
                Batal Edit
              </button>
            ) : null}
          </form>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#F0EDE8] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Akun dashboard tenant</h2>
          </div>
          <div className="divide-y divide-[#F0EDE8]">
            {members.map((member) => (
              <div key={member.membership_id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="font-semibold text-[#1A1A1A]">{member.full_name}</p>
                  <p className="text-sm text-[#6B6B6B]">{member.email}</p>
                  <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">
                    {member.role} • {member.status} {member.is_primary ? "• primary" : ""}
                  </p>
                  {member.last_login_at ? (
                    <p className="text-xs text-[#A3A3A3]">Login terakhir {formatDate(member.last_login_at)}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMemberId(member.membership_id);
                    setMemberForm({
                      full_name: member.full_name,
                      email: member.email,
                      phone_number: member.phone_number,
                      password: "",
                      role: member.role,
                      status: member.status,
                    });
                  }}
                  className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-xs font-bold text-[#1A1A1A]"
                >
                  Edit
                </button>
              </div>
            ))}
            {members.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[#A3A3A3]">Belum ada anggota tim tambahan.</div>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-[#F0EDE8] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#F0EDE8] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Akses POS barber</h2>
          </div>
          <div className="divide-y divide-[#F0EDE8]">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="font-semibold text-[#1A1A1A]">{account.barber_name}</p>
                  <p className="text-sm text-[#6B6B6B]">Kode akses: {account.access_code}</p>
                  <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">{account.status}</p>
                  {account.last_login_at ? (
                    <p className="text-xs text-[#A3A3A3]">Login terakhir {formatDate(account.last_login_at)}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAccessId(account.id);
                    setAccessStatus(account.status);
                    setAccessForm({
                      barber_id: account.barber_id,
                      pin: "",
                      regenerate_code: false,
                    });
                  }}
                  className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-xs font-bold text-[#1A1A1A]"
                >
                  Edit
                </button>
              </div>
            ))}
            {accounts.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[#A3A3A3]">Belum ada akses POS barber.</div>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
