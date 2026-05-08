"use client";

import { useState } from "react";

import { formatIDR, type PlatformDataset } from "../lib/platform-types";

type BillingOrder = PlatformDataset["billingOrders"]["orders"][number];

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
    throw new Error(payload?.error ?? "Gagal memperbarui status order paket.");
  }
  return payload;
}

export function BillingOrderStatusManager({
  initialOrders,
  focusTenantID,
}: {
  initialOrders: BillingOrder[];
  focusTenantID?: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  const sortedOrders = [...orders].sort((left, right) => {
    if (focusTenantID) {
      if (left.tenant_id === focusTenantID) return -1;
      if (right.tenant_id === focusTenantID) return 1;
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });

  async function handleStatus(orderId: string, status: string) {
    try {
      setSavingId(orderId);
      setMessage("");
      const payload = await requestJSON(`/api/billing-orders/${orderId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setOrders((current) => current.map((item) => (item.id === orderId ? payload : item)));
      setMessage(`Status order berhasil diubah menjadi ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memperbarui status order.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-zinc-400">{message}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tenant</th>
              <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Paket</th>
              <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Coupon</th>
              <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Total</th>
              <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {sortedOrders.map((order) => (
              <tr key={order.id} className={focusTenantID === order.tenant_id ? "bg-zinc-800/20" : ""}>
                <td className="px-4 py-4">
                  <strong className="block text-sm font-bold text-zinc-200">{order.tenant_name}</strong>
                  <span className="text-xs text-zinc-500">{order.tenant_id}</span>
                </td>
                <td className="px-4 py-4 text-sm text-zinc-300 uppercase">
                  {order.plan_code} • {order.billing_cycle}
                </td>
                <td className="px-4 py-4 text-sm text-zinc-400">{order.coupon_code || "-"}</td>
                <td className="px-4 py-4 text-sm font-semibold text-zinc-100">{formatIDR(order.total_amount_idr)}</td>
                <td className="px-4 py-4 text-sm uppercase text-zinc-300">{order.status}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    {order.status !== "waiting_confirmation" ? (
                      <button
                        type="button"
                        disabled={savingId === order.id}
                        onClick={() => void handleStatus(order.id, "waiting_confirmation")}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200"
                      >
                        Review
                      </button>
                    ) : null}
                    {order.status !== "paid" ? (
                      <button
                        type="button"
                        disabled={savingId === order.id}
                        onClick={() => void handleStatus(order.id, "paid")}
                        className="rounded-lg bg-[#C8A464] px-3 py-1.5 text-xs font-semibold text-black"
                      >
                        Paid
                      </button>
                    ) : null}
                    {order.status !== "rejected" ? (
                      <button
                        type="button"
                        disabled={savingId === order.id}
                        onClick={() => void handleStatus(order.id, "rejected")}
                        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300"
                      >
                        Reject
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
