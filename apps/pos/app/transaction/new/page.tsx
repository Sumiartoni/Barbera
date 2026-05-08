"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";

import { clientRequest } from "@/lib/client-api";

const SERVICES = [
  { id: "potong", label: "Potong Rambut", price: 45000, duration: "30 mnt", icon: "✂️" },
  { id: "cuci", label: "Cuci Rambut", price: 20000, duration: "15 mnt", icon: "🚿" },
  { id: "jenggot", label: "Cukur Jenggot", price: 30000, duration: "20 mnt", icon: "🪒" },
  { id: "massage", label: "Massage Kepala", price: 35000, duration: "20 mnt", icon: "💆" },
  { id: "wax", label: "Wax / Finishing", price: 15000, duration: "10 mnt", icon: "✨" },
  { id: "anak", label: "Potong Anak", price: 35000, duration: "25 mnt", icon: "👦" },
];

type POSSession = {
  staff: {
    full_name: string;
  };
};

type QueueTicketResponse = {
  queue_ticket: {
    id: string;
    queue_number: number;
    customer_name: string;
  };
  assigned_barber_name: string;
};

type FormState = {
  customerName: string;
  phone: string;
  selectedServices: string[];
  notes: string;
};

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function NewTransactionPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [session, setSession] = useState<POSSession | null>(null);
  const [form, setForm] = useState<FormState>({
    customerName: "",
    phone: "",
    selectedServices: [],
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successTicket, setSuccessTicket] = useState<QueueTicketResponse | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await clientRequest<POSSession>("/api/auth/me");
        setSession(result);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Session POS tidak tersedia.",
        );
      }
    })();
  }, []);

  const selectedDetails = useMemo(
    () => SERVICES.filter((service) => form.selectedServices.includes(service.id)),
    [form.selectedServices],
  );
  const totalPrice = selectedDetails.reduce((sum, service) => sum + service.price, 0);
  const totalDuration = selectedDetails.reduce(
    (sum, service) => sum + parseInt(service.duration.replace(" mnt", ""), 10),
    0,
  );
  const canSubmit = form.customerName.trim().length >= 2 && form.selectedServices.length > 0;

  const toggleService = (id: string) => {
    setForm((current) => ({
      ...current,
      selectedServices: current.selectedServices.includes(id)
        ? current.selectedServices.filter((serviceId) => serviceId !== id)
        : [...current.selectedServices, id],
    }));
  };

  async function handleSubmit() {
    try {
      setLoading(true);
      setError("");

      const result = await clientRequest<QueueTicketResponse>("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.customerName,
          phone: form.phone,
          notes: form.notes,
          services: selectedDetails,
        }),
      });

      setSuccessTicket(result);
      setStep("success");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menambahkan pelanggan ke antrean.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (step === "success" && successTicket) {
    return (
      <div className="pos-page min-h-dvh flex flex-col">
        <div className="pos-content pos-container flex flex-col items-center justify-center min-h-[80dvh] text-center animate-slide-up">
          <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold-dark), var(--gold), var(--gold-light))",
                boxShadow: "0 8px 40px var(--gold-glow)",
              }}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="#0A0A0B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                Antrean Ditambahkan!
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Pelanggan berhasil masuk antrean live
              </p>
            </div>

            <div className="w-full card-pos p-6 text-left" style={{ borderColor: "var(--gold)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="metric-label">Nomor Antrean</p>
                  <p
                    className="text-5xl font-bold"
                    style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}
                  >
                    #{successTicket.queue_ticket.queue_number}
                  </p>
                </div>
                <div className="text-5xl">✂️</div>
              </div>
              <div className="divider-gold" />
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Nama
                  </span>
                  <span className="text-sm font-semibold">{successTicket.queue_ticket.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Layanan
                  </span>
                  <span className="text-sm font-semibold text-right" style={{ maxWidth: "55%" }}>
                    {selectedDetails.map((service) => service.label).join(", ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Barber
                  </span>
                  <span className="text-sm font-semibold">{successTicket.assigned_barber_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Estimasi total
                  </span>
                  <span className="text-sm font-bold" style={{ color: "var(--gold)" }}>
                    {formatRupiah(totalPrice)}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full flex flex-col sm:flex-row gap-3">
              <button
                id="btn-add-another"
                onClick={() => {
                  setStep("form");
                  setSuccessTicket(null);
                  setForm({
                    customerName: "",
                    phone: "",
                    selectedServices: [],
                    notes: "",
                  });
                }}
                className="btn-gold flex-1 py-4 text-base"
              >
                + Tambah Pelanggan Lagi
              </button>
              <button
                id="btn-back-home"
                onClick={() => router.push("/")}
                className="flex-1 py-4 text-base font-semibold rounded-2xl transition-all"
                style={{
                  color: "var(--text-secondary)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                Kembali ke Beranda
              </button>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="pos-page flex flex-col min-h-dvh">
        <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="pos-container py-4 flex items-center gap-4">
            <button
              onClick={() => setStep("form")}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--surface-2)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M19 12H5M12 19l-7-7 7-7"
                  stroke="var(--text-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div>
              <h2 className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
                Konfirmasi Antrean
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Cek kembali sebelum menyimpan
              </p>
            </div>
          </div>
        </header>

        <div className="pos-content pos-container pt-5">
          {error ? (
            <div
              className="mb-4 rounded-2xl px-4 py-3 text-sm font-medium"
              style={{ background: "rgba(244, 67, 54, 0.1)", color: "var(--danger)" }}
            >
              {error}
            </div>
          ) : null}

          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card-pos">
                <p className="metric-label mb-3">Detail Pelanggan</p>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Nama
                    </span>
                    <span className="text-sm font-semibold">{form.customerName}</span>
                  </div>
                  {form.phone ? (
                    <div className="flex justify-between">
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                        No. HP
                      </span>
                      <span className="text-sm font-semibold">{form.phone}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Barber
                    </span>
                    <span className="text-sm font-semibold">{session?.staff.full_name ?? "-"}</span>
                  </div>
                </div>
              </div>
              <div className="card-pos">
                <p className="metric-label mb-3">Layanan Dipilih</p>
                <div className="flex flex-col gap-2">
                  {selectedDetails.map((service) => (
                    <div key={service.id} className="flex justify-between items-center">
                      <span className="text-sm">
                        {service.icon} {service.label}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: "var(--gold)" }}>
                        {formatRupiah(service.price)}
                      </span>
                    </div>
                  ))}
                  <div className="divider-gold" />
                  <div className="flex justify-between">
                    <span className="text-sm font-bold">Total</span>
                    <span className="text-base font-bold" style={{ color: "var(--gold)" }}>
                      {formatRupiah(totalPrice)}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Est. waktu: {totalDuration} menit
                  </span>
                </div>
              </div>
            </div>

            {form.notes ? (
              <div className="card-pos">
                <p className="metric-label mb-2">Catatan</p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {form.notes}
                </p>
              </div>
            ) : null}

            <button
              id="btn-confirm-submit"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-gold w-full py-4 text-base mt-2 gap-3"
              style={{ borderRadius: "14px" }}
            >
              {loading ? (
                <span
                  className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
                  style={{ borderColor: "#0A0A0B transparent transparent transparent" }}
                />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="#0A0A0B"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Simpan & Masukkan Antrean
                </>
              )}
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="pos-page flex flex-col min-h-dvh">
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="pos-container py-4 flex items-center gap-4">
          <button
            id="btn-back"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--surface-2)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M19 12H5M12 19l-7-7 7-7"
                stroke="var(--text-primary)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div>
            <h1
              className="font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              Input Pelanggan
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Walk-in / antrean baru
            </p>
          </div>
        </div>
      </header>

      <div className="pos-content pos-container pt-5 animate-slide-up">
        {error ? (
          <div
            className="mb-4 rounded-2xl px-4 py-3 text-sm font-medium"
            style={{ background: "rgba(244, 67, 54, 0.1)", color: "var(--danger)" }}
          >
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="customer-name" className="metric-label">
                Nama Pelanggan <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                id="customer-name"
                type="text"
                className="input-pos text-base"
                placeholder="Masukkan nama pelanggan..."
                value={form.customerName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, customerName: event.target.value }))
                }
                autoComplete="off"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="metric-label">
                No. HP{" "}
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontWeight: 400,
                    textTransform: "none",
                    letterSpacing: "normal",
                  }}
                >
                  (opsional)
                </span>
              </label>
              <input
                id="phone"
                type="tel"
                className="input-pos"
                placeholder="08xxxxxxxxxx"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                inputMode="tel"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="metric-label">Barber aktif</label>
              <div
                className="px-4 py-3 rounded-2xl text-sm font-semibold"
                style={{
                  background: "rgba(201,168,76,0.1)",
                  color: "var(--gold)",
                  border: "1px solid var(--gold)",
                }}
              >
                {session?.staff.full_name ?? "Memuat barber..."}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="notes" className="metric-label">
                Catatan Tambahan
              </label>
              <textarea
                id="notes"
                className="input-pos resize-none"
                placeholder="Contoh: pelanggan ingin dipanggil saat kursi siap..."
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="metric-label">
              Layanan <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.map((service) => {
                const selected = form.selectedServices.includes(service.id);
                return (
                  <button
                    key={service.id}
                    id={`service-${service.id}`}
                    onClick={() => toggleService(service.id)}
                    className="flex flex-col gap-1 p-3 rounded-2xl text-left transition-all active:scale-95"
                    style={{
                      background: selected ? "rgba(201,168,76,0.1)" : "var(--surface-2)",
                      border: `1.5px solid ${
                        selected ? "var(--gold)" : "var(--border-subtle)"
                      }`,
                    }}
                  >
                    <span className="text-xl">{service.icon}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color: selected ? "var(--gold)" : "var(--text-primary)",
                      }}
                    >
                      {service.label}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatRupiah(service.price)} · {service.duration}
                    </span>
                  </button>
                );
              })}
            </div>

            {form.selectedServices.length > 0 ? (
              <div
                className="card-pos animate-fade-in"
                style={{
                  borderColor: "var(--gold)",
                  background: "rgba(201,168,76,0.05)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {selectedDetails.length} layanan · {totalDuration} mnt
                    </p>
                    <p
                      className="font-bold text-lg"
                      style={{ color: "var(--gold)", fontFamily: "var(--font-display)" }}
                    >
                      {formatRupiah(totalPrice)}
                    </p>
                  </div>
                  <span className="text-2xl">
                    {selectedDetails.map((service) => service.icon).join("")}
                  </span>
                </div>
              </div>
            ) : null}

            <button
              id="btn-next-confirm"
              onClick={() => setStep("confirm")}
              disabled={!canSubmit}
              className="btn-gold w-full py-4 text-base hidden lg:flex items-center justify-center gap-2"
              style={{ opacity: canSubmit ? 1 : 0.4, pointerEvents: canSubmit ? "auto" : "none" }}
            >
              Lanjut ke Konfirmasi →
            </button>
          </div>
        </div>

        <div className="mt-5 lg:hidden">
          <button
            id="btn-next-confirm-mobile"
            onClick={() => setStep("confirm")}
            disabled={!canSubmit}
            className="btn-gold w-full py-4 text-base"
            style={{ opacity: canSubmit ? 1 : 0.4, pointerEvents: canSubmit ? "auto" : "none" }}
          >
            Lanjut ke Konfirmasi →
          </button>
        </div>

        <div className="h-5" />
      </div>

      <BottomNav />
    </div>
  );
}
