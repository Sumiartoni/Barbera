"use client";

import { useMemo, useState } from "react";
import type { PlansResponse } from "../lib/platform-types";
import { formatIDR } from "../lib/platform-types";

type PlanRecord = PlansResponse["plans"][number];

type DraftState = Record<
  string,
  {
    name: string;
    description: string;
    monthly_price_idr: string;
    yearly_price_idr: string;
    billing_cycle_days: string;
    max_outlets: string;
    max_users: string;
    max_customers: string;
    max_reminders_per_month: string;
    max_whatsapp_sessions: string;
    allow_campaigns: boolean;
    allow_loyalty: boolean;
    allow_exports: boolean;
    allow_multi_outlet: boolean;
  }
>;

function toDraftMap(plans: PlanRecord[]): DraftState {
  return Object.fromEntries(
    plans.map((plan) => [
      plan.code,
      {
        name: plan.name,
        description: plan.description ?? "",
        monthly_price_idr: String(plan.monthly_price_idr ?? 0),
        yearly_price_idr: String(plan.yearly_price_idr ?? 0),
        billing_cycle_days: String(plan.billing_cycle_days ?? 30),
        max_outlets: String(plan.max_outlets ?? 1),
        max_users: String(plan.max_users ?? 1),
        max_customers: String(plan.max_customers ?? 100),
        max_reminders_per_month: String(plan.max_reminders_per_month ?? 50),
        max_whatsapp_sessions: String(plan.max_whatsapp_sessions ?? 1),
        allow_campaigns: Boolean(plan.allow_campaigns),
        allow_loyalty: Boolean(plan.allow_loyalty),
        allow_exports: Boolean(plan.allow_exports),
        allow_multi_outlet: Boolean(plan.allow_multi_outlet),
      },
    ]),
  );
}

export function PlanManagementPanel({ plans }: { plans: PlanRecord[] }) {
  const [drafts, setDrafts] = useState<DraftState>(() => toDraftMap(plans));
  const [savingCode, setSavingCode] = useState("");
  const [message, setMessage] = useState<Record<string, string>>({});

  const sortedPlans = useMemo(
    () =>
      [...plans].sort(
        (left, right) =>
          Number(left.is_free) - Number(right.is_free) || left.name.localeCompare(right.name),
      ),
    [plans],
  );

  function updateDraft(
    planCode: string,
    key: keyof DraftState[string],
    value: string | boolean,
  ) {
    setDrafts((current) => ({
      ...current,
      [planCode]: {
        ...current[planCode],
        [key]: value,
      },
    }));
  }

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
      throw new Error(payload?.error ?? "Gagal menyimpan paket.");
    }
    return payload;
  }

  async function handleSave(planCode: string) {
    const draft = drafts[planCode];
    if (!draft) {
      return;
    }

    try {
      setSavingCode(planCode);
      setMessage((current) => ({ ...current, [planCode]: "" }));

      await requestJSON(`/api/plans/${planCode}`, {
        method: "PUT",
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          monthly_price_idr: Number(draft.monthly_price_idr || 0),
          yearly_price_idr: Number(draft.yearly_price_idr || 0),
          billing_cycle_days: Number(draft.billing_cycle_days || 30),
          max_outlets: Number(draft.max_outlets || 1),
          max_users: Number(draft.max_users || 1),
          max_customers: Number(draft.max_customers || 100),
          max_reminders_per_month: Number(draft.max_reminders_per_month || 50),
          max_whatsapp_sessions: Number(draft.max_whatsapp_sessions || 1),
          allow_campaigns: draft.allow_campaigns,
          allow_loyalty: draft.allow_loyalty,
          allow_exports: draft.allow_exports,
          allow_multi_outlet: draft.allow_multi_outlet,
        }),
      });

      setMessage((current) => ({ ...current, [planCode]: "Perubahan paket berhasil disimpan." }));
    } catch (error) {
      setMessage((current) => ({
        ...current,
        [planCode]: error instanceof Error ? error.message : "Gagal memperbarui paket.",
      }));
    } finally {
      setSavingCode("");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {sortedPlans.map((plan) => {
        const draft = drafts[plan.code];
        const isSaving = savingCode === plan.code;

        return (
          <article key={plan.code} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-zinc-100">{draft.name}</h3>
                  <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] uppercase text-zinc-400">
                    {plan.code}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">
                  Harga aktif saat ini: {plan.is_free ? "Gratis permanen" : formatIDR(Number(draft.monthly_price_idr || 0))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSave(plan.code)}
                disabled={isSaving}
                className="rounded-xl bg-[#C8A464] px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
              >
                {isSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Nama paket</span>
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft(plan.code, "name", event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Durasi billing (hari)</span>
                <input
                  type="number"
                  min={1}
                  value={draft.billing_cycle_days}
                  onChange={(event) => updateDraft(plan.code, "billing_cycle_days", event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Deskripsi</span>
                <textarea
                  value={draft.description}
                  onChange={(event) => updateDraft(plan.code, "description", event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Harga bulanan (IDR)</span>
                <input
                  type="number"
                  min={0}
                  value={draft.monthly_price_idr}
                  onChange={(event) => updateDraft(plan.code, "monthly_price_idr", event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Harga tahunan (IDR)</span>
                <input
                  type="number"
                  min={0}
                  value={draft.yearly_price_idr}
                  onChange={(event) => updateDraft(plan.code, "yearly_price_idr", event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Maks outlet</span>
                <input
                  type="number"
                  min={1}
                  value={draft.max_outlets}
                  onChange={(event) => updateDraft(plan.code, "max_outlets", event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Maks user</span>
                <input
                  type="number"
                  min={1}
                  value={draft.max_users}
                  onChange={(event) => updateDraft(plan.code, "max_users", event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Maks customer</span>
                <input
                  type="number"
                  min={1}
                  value={draft.max_customers}
                  onChange={(event) => updateDraft(plan.code, "max_customers", event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Maks reminder / bulan</span>
                <input
                  type="number"
                  min={0}
                  value={draft.max_reminders_per_month}
                  onChange={(event) => updateDraft(plan.code, "max_reminders_per_month", event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Maks sesi WhatsApp</span>
                <input
                  type="number"
                  min={1}
                  value={draft.max_whatsapp_sessions}
                  onChange={(event) => updateDraft(plan.code, "max_whatsapp_sessions", event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                ["allow_campaigns", "Campaigns"],
                ["allow_loyalty", "Loyalty"],
                ["allow_exports", "Exports"],
                ["allow_multi_outlet", "Multi outlet"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300"
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(draft[key as keyof typeof draft])}
                    onChange={(event) =>
                      updateDraft(plan.code, key as keyof DraftState[string], event.target.checked)
                    }
                    className="h-4 w-4 accent-[#C8A464]"
                  />
                </label>
              ))}
            </div>

            {message[plan.code] ? (
              <p className="mt-4 text-sm text-zinc-400">{message[plan.code]}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
