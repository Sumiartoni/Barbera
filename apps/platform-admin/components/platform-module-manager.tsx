"use client";

import { useEffect, useMemo, useState } from "react";

type FieldSchema = {
  key: string;
  label: string;
  type: "text" | "number" | "textarea";
  placeholder?: string;
};

type ResourceItem = {
  id: string;
  resource_type: string;
  resource_key?: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function parseValue(field: FieldSchema, value: string) {
  if (field.type === "number") {
    return Number(value || 0);
  }
  return value;
}

async function requestJSON(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? "Gagal memproses permintaan platform.");
  }
  return payload;
}

export function PlatformResourceManager({
  resourceType,
  title,
  description,
  fields,
}: {
  resourceType: string;
  title: string;
  description: string;
  fields: FieldSchema[];
}) {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingID, setEditingID] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string>>({ name: "", status: "active", resource_key: "" });

  const emptyForm = useMemo(() => {
    const next: Record<string, string> = { name: "", status: "active", resource_key: "" };
    for (const field of fields) {
      next[field.key] = "";
    }
    return next;
  }, [fields]);

  async function loadItems() {
    try {
      setLoading(true);
      const response = await fetch(`/api/resources/${resourceType}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Gagal memuat resource platform.");
      }
      setItems(payload.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat resource platform.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, [resourceType]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const body = {
        resource_key: form.resource_key,
        name: form.name,
        status: form.status,
        config: Object.fromEntries(fields.map((field) => [field.key, parseValue(field, form[field.key] ?? "")])),
      };
      if (editingID) {
        await requestJSON(`/api/resources/${resourceType}/${editingID}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await requestJSON(`/api/resources/${resourceType}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setEditingID("");
      setForm(emptyForm);
      await loadItems();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal menyimpan resource platform.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemID: string) {
    try {
      setError("");
      await requestJSON(`/api/resources/${resourceType}/${itemID}`, {
        method: "DELETE",
      });
      await loadItems();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus resource platform.");
    }
  }

  function handleEdit(item: ResourceItem) {
    const next: Record<string, string> = {
      ...emptyForm,
      name: item.name,
      status: item.status,
      resource_key: item.resource_key ?? "",
    };
    for (const field of fields) {
      next[field.key] = String(item.config?.[field.key] ?? "");
    }
    setForm(next);
    setEditingID(item.id);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h3 className="text-lg font-bold text-zinc-100">{title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <input
            value={form.name ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Nama item"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
            required
          />
          <input
            value={form.resource_key ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, resource_key: event.target.value }))}
            placeholder="Resource key"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
          {fields.map((field) =>
            field.type === "textarea" ? (
              <textarea
                key={field.key}
                value={form[field.key] ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="min-h-24 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            ) : (
              <input
                key={field.key}
                type={field.type}
                value={form[field.key] ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            ),
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[#C8A464] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : editingID ? "Simpan Perubahan" : "Tambah Item"}
          </button>
        </form>
      </article>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <div className="border-b border-zinc-800 px-6 py-4">
          <h3 className="text-lg font-bold text-zinc-100">Daftar item</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Konfigurasi</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-sm text-zinc-500">
                    Belum ada data.
                  </td>
                </tr>
              ) : null}
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-zinc-100">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.resource_key || "-"}</p>
                  </td>
                  <td className="px-4 py-4 text-sm uppercase text-zinc-300">{item.status}</td>
                  <td className="px-4 py-4 text-xs text-zinc-400">
                    {fields.length === 0
                      ? "-"
                      : fields.map((field) => `${field.label}: ${String(item.config?.[field.key] ?? "-")}`).join(" • ")}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

export function PlatformConfigManager({
  configType,
  title,
  description,
  fields,
}: {
  configType: string;
  title: string;
  description: string;
  fields: FieldSchema[];
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/config/${configType}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error ?? "Gagal memuat konfigurasi.");
        }
        const config = payload.config ?? {};
        setForm(Object.fromEntries(fields.map((field) => [field.key, String(config[field.key] ?? "")])));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Gagal memuat konfigurasi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [configType, fields]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage("");
      await requestJSON(`/api/config/${configType}`, {
        method: "PUT",
        body: JSON.stringify({
          config: Object.fromEntries(fields.map((field) => [field.key, parseValue(field, form[field.key] ?? "")])),
        }),
      });
      setMessage("Konfigurasi berhasil disimpan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-lg font-bold text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
      {message ? <p className="mt-4 text-sm text-zinc-400">{message}</p> : null}
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        {fields.map((field) =>
          field.type === "textarea" ? (
            <label key={field.key} className="space-y-2 text-sm text-zinc-300 md:col-span-2">
              <span>{field.label}</span>
              <textarea
                value={form[field.key] ?? ""}
                disabled={loading}
                onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="min-h-24 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
          ) : (
            <label key={field.key} className="space-y-2 text-sm text-zinc-300">
              <span>{field.label}</span>
              <input
                type={field.type}
                value={form[field.key] ?? ""}
                disabled={loading}
                onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
          ),
        )}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-xl bg-[#C8A464] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
          </button>
        </div>
      </form>
    </article>
  );
}
