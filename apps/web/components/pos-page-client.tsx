"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import { loadSession, syncSessionProfile, type SessionState } from "../lib/session";
import { TenantShell } from "./tenant-shell";

type CustomerRecord = {
  id: string;
  full_name: string;
  phone_number: string;
  preferred_barber_id?: string;
  preferred_barber: string;
  notes: string;
  total_visits: number;
  total_spent_idr: number;
  last_visit_at?: string;
};

type BarberRecord = {
  id: string;
  full_name: string;
  on_shift?: boolean;
  status?: string;
};

type StationRecord = {
  id: string;
  name: string;
  status?: string;
};

type ServiceOption = {
  id: string;
  name: string;
  status: string;
  config: {
    base_price_idr?: number;
    duration_minutes?: number;
    description?: string;
  };
};

type QueueTicket = {
  id: string;
  customer_id: string;
  customer_name: string;
  queue_number: number;
  service_summary: string;
  preferred_barber_id?: string;
  preferred_barber?: string;
  assigned_barber_id?: string;
  assigned_barber?: string;
  station_id?: string;
  station_name?: string;
  status: string;
  source: string;
  estimated_wait_minutes: number;
  requested_at: string;
};

type VisitRecord = {
  id: string;
  customer_id: string;
  customer_name: string;
  phone_number: string;
  service_name: string;
  barber_name: string;
  amount_idr: number;
  payment_status: string;
  notes: string;
  visit_at: string;
  next_reminder_at?: string;
};

function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function PosPageClient() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [barbers, setBarbers] = useState<BarberRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [queueTickets, setQueueTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [isPending, startTransition] = useTransition();
  const [customerForm, setCustomerForm] = useState({
    full_name: "",
    phone_number: "",
    preferred_barber_id: "",
    notes: ""
  });
  const [visitForm, setVisitForm] = useState({
    customer_id: "",
    queue_ticket_id: "",
    service_id: "",
    service_name: "",
    barber_id: "",
    barber_name: "",
    station_id: "",
    amount_idr: "",
    payment_status: "paid",
    reminder_days: "21",
    notes: ""
  });

  useEffect(() => {
    const activeSession = loadSession();
    setSession(activeSession);

    if (!activeSession?.access_token) {
      setLoading(false);
      return;
    }

    void (async () => {
      const refreshedSession = await syncSessionProfile();
      if (refreshedSession) {
        setSession(refreshedSession);
      }

      await refreshData((refreshedSession ?? activeSession).access_token, deferredSearch);
    })();
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    void refreshData(session.access_token, deferredSearch);
  }, [deferredSearch, session]);

  async function refreshData(token: string, query = "") {
    setLoading(true);
    try {
      const [customerResponse, visitResponse, barberResponse, stationResponse, serviceResponse, queueResponse] = await Promise.all([
        apiRequest<{ customers: CustomerRecord[] }>(
          `/api/v1/customers?limit=12&q=${encodeURIComponent(query)}`,
          { token }
        ),
        apiRequest<{ visits: VisitRecord[] }>("/api/v1/visits?limit=10", {
          token
        }),
        apiRequest<{ barbers: BarberRecord[] }>("/api/v1/barbers", { token }),
        apiRequest<{ stations: StationRecord[] }>("/api/v1/stations", { token }),
        apiRequest<{ items: ServiceOption[] }>("/api/v1/resources/service", { token }),
        apiRequest<{ tickets: QueueTicket[] }>("/api/v1/queue", { token })
      ]);

      setCustomers(customerResponse.customers);
      setVisits(visitResponse.visits);
      setBarbers(barberResponse.barbers);
      setStations(stationResponse.stations);
      setServices(
        serviceResponse.items.filter((item) => item.status === "active")
      );
      setQueueTickets(
        queueResponse.tickets.filter((ticket) =>
          ticket.status === "waiting" || ticket.status === "assigned" || ticket.status === "in_service"
        )
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memuat data POS."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCreateCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) {
      return;
    }

    setError("");
    setMessage("");

    startTransition(() => {
      void (async () => {
        try {
          const customer = await apiRequest<CustomerRecord>("/api/v1/customers", {
            method: "POST",
            token: session.access_token,
            body: customerForm
          });

          setMessage("Pelanggan baru berhasil ditambahkan ke CRM.");
          setVisitForm((current) => ({
            ...current,
            customer_id: customer.id,
            barber_id: customer.preferred_barber_id ?? current.barber_id
          }));
          setCustomerForm({
            full_name: "",
            phone_number: "",
            preferred_barber_id: "",
            notes: ""
          });
          await refreshData(session.access_token, deferredSearch);
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Gagal menambahkan pelanggan."
          );
        }
      })();
    });
  }

  function handleCreateVisit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) {
      return;
    }

    setError("");
    setMessage("");

    startTransition(() => {
      void (async () => {
        try {
          await apiRequest<VisitRecord>("/api/v1/visits", {
            method: "POST",
            token: session.access_token,
            body: {
              customer_id: visitForm.customer_id,
              queue_ticket_id: visitForm.queue_ticket_id,
              service_name: visitForm.service_name,
              barber_id: visitForm.barber_id,
              barber_name: visitForm.barber_name,
              station_id: visitForm.station_id,
              amount_idr: Number(visitForm.amount_idr || 0),
              payment_status: visitForm.payment_status,
              reminder_days: Number(visitForm.reminder_days || 0),
              notes: visitForm.notes
            }
          });

          setMessage("Kunjungan berhasil disimpan dari POS.");
          setVisitForm((current) => ({
            ...current,
            queue_ticket_id: "",
            service_id: "",
            service_name: "",
            barber_id: "",
            barber_name: "",
            station_id: "",
            amount_idr: "",
            notes: ""
          }));
          await refreshData(session.access_token, deferredSearch);
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Gagal menyimpan kunjungan."
          );
        }
      })();
    });
  }

  if (!session) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center p-4">
        <section className="bg-white rounded-2xl shadow-xl border border-[#F0EDE8] p-8 max-w-md w-full mx-auto text-center">
          <p className="text-sm font-semibold tracking-wider text-[#C8A464] mb-2 uppercase">Barbera POS</p>
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-4">Session belum tersedia.</h1>
          <p className="text-[#6B6B6B] mb-8">
            Login dulu dari halaman tenant agar POS bisa membuat pelanggan dan kunjungan baru.
          </p>
          <div className="pt-2 border-t border-[#F0EDE8]">
            <Link href="/login" className="inline-flex items-center justify-center w-full py-3 bg-[#C8A464] hover:bg-[#B89454] text-white rounded-xl font-semibold transition-colors mt-4">
              Ke Halaman Login
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const activeBarbers = [...barbers]
    .filter((barber) => barber.status !== "inactive")
    .sort((left, right) => Number(Boolean(right.on_shift)) - Number(Boolean(left.on_shift)));
  const activeStations = stations.filter((station) => station.status !== "inactive");
  const selectedCustomer = customers.find((customer) => customer.id === visitForm.customer_id);
  const selectedService = services.find((service) => service.id === visitForm.service_id);
  const selectedQueueTicket = queueTickets.find((ticket) => ticket.id === visitForm.queue_ticket_id);

  function matchServiceToOption(serviceSummary: string) {
    const normalized = serviceSummary.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    return services.find((service) => {
      const serviceName = service.name.trim().toLowerCase();
      return (
        serviceName === normalized ||
        normalized.includes(serviceName) ||
        serviceName.includes(normalized)
      );
    });
  }

  function handleServiceChange(serviceID: string) {
    const selected = services.find((service) => service.id === serviceID);
    setVisitForm((current) => ({
      ...current,
      service_id: serviceID,
      service_name: selected?.name ?? "",
      amount_idr:
        selected?.config.base_price_idr != null
          ? String(selected.config.base_price_idr)
          : current.amount_idr,
      notes:
        !current.notes && selected?.config.description
          ? selected.config.description
          : current.notes
    }));
  }

  function handleCustomerChange(customerID: string) {
    const customer = customers.find((item) => item.id === customerID);
    setVisitForm((current) => ({
      ...current,
      customer_id: customerID,
      queue_ticket_id: current.queue_ticket_id,
      barber_id: customer?.preferred_barber_id ?? current.barber_id
    }));
  }

  function handleBarberChange(barberID: string) {
    const selected = activeBarbers.find((barber) => barber.id === barberID);
    setVisitForm((current) => ({
      ...current,
      barber_id: barberID,
      barber_name: selected?.full_name ?? ""
    }));
  }

  function handleLoadQueueTicket(ticket: QueueTicket) {
    const matchedService = matchServiceToOption(ticket.service_summary);
    const preferredBarberID = ticket.assigned_barber_id || ticket.preferred_barber_id || "";
    const preferredBarber =
      activeBarbers.find((barber) => barber.id === preferredBarberID)?.full_name ?? "";

    setVisitForm((current) => ({
      ...current,
      customer_id: ticket.customer_id,
      queue_ticket_id: ticket.id,
      service_id: matchedService?.id ?? current.service_id,
      service_name: matchedService?.name ?? ticket.service_summary,
      barber_id: preferredBarberID,
      barber_name: preferredBarber,
      station_id: ticket.station_id ?? current.station_id,
      amount_idr:
        matchedService?.config.base_price_idr != null
          ? String(matchedService.config.base_price_idr)
          : current.amount_idr,
      notes: ticket.source === "whatsapp"
        ? "Booking masuk dari WhatsApp customer."
        : current.notes
    }));
    setMessage(`Antrean #${ticket.queue_number} dimuat ke POS. Tinggal konfirmasi dan simpan kunjungan.`);
  }

  return (
    <TenantShell
      session={session}
      active="pos"
      title="POS Front Desk"
      description="Tambah pelanggan baru, pilih customer aktif, lalu simpan kunjungan agar CRM dan reminder tetap sinkron."
    >
      {error ? (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl font-medium">
          {error}
        </div>
      ) : null}
      
      {message ? (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-medium flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {message}
        </div>
      ) : null}
      
      {loading ? (
        <div className="mb-6 p-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-medium flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          Memuat data...
        </div>
      ) : null}

      <section className="mb-8">
        <article className="bg-white rounded-2xl border border-[#F0EDE8] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F0EDE8] bg-[#FCFBFA] flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1A1A1A]">Antrean siap diproses di POS</h2>
              <p className="text-sm text-[#6B6B6B] mt-1">
                Ambil antrean walk-in atau booking WhatsApp, lalu lanjutkan proses tanpa input ulang.
              </p>
            </div>
            <div className="rounded-xl bg-[#1A1A1A] px-4 py-2 text-white text-sm font-bold">
              {queueTickets.length} antrean aktif
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-6">
            {queueTickets.length ? (
              queueTickets.map((ticket) => (
                <article
                  key={ticket.id}
                  className={`rounded-2xl border px-4 py-4 ${
                    visitForm.queue_ticket_id === ticket.id
                      ? "border-[#C8A464] bg-[#FFFBF0]"
                      : "border-[#F0EDE8] bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#1A1A1A]">
                        #{ticket.queue_number} • {ticket.customer_name}
                      </p>
                      <p className="text-sm text-[#6B6B6B] mt-1">{ticket.service_summary || "Layanan umum"}</p>
                      <p className="text-xs text-[#A3A3A3] mt-2">
                        {ticket.source === "whatsapp" ? "Booking WhatsApp" : "Walk-in"} • {ticket.assigned_barber || ticket.preferred_barber || "Belum pilih barber"} • {ticket.station_name || "Belum assign kursi"}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#F5F5F5] px-3 py-1 text-[11px] font-bold uppercase text-[#6B6B6B]">
                      {ticket.status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-[#6B6B6B]">
                      {ticket.status === "in_service"
                        ? "Sedang dikerjakan sekarang"
                        : `Estimasi tunggu ${ticket.estimated_wait_minutes || 0} menit`}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleLoadQueueTicket(ticket)}
                      className="rounded-xl border border-[#C8A464] px-3 py-2 text-xs font-bold text-[#C8A464] hover:bg-[#FFF8EA] transition-colors"
                    >
                      Proses di POS
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[#E5E5E5] px-4 py-8 text-sm text-[#6B6B6B] text-center xl:col-span-2">
                Belum ada antrean aktif. Booking dari WhatsApp dan walk-in akan muncul di sini.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <article className="bg-white rounded-2xl border border-[#F0EDE8] shadow-sm p-6 lg:p-8">
          <h2 className="text-xl font-bold text-[#1A1A1A] mb-6">Tambah pelanggan baru</h2>
          <form onSubmit={handleCreateCustomer}>
            <fieldset className="flex flex-col gap-5 border-none p-0 m-0" disabled={isPending}>
              <div>
                <label className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Nama pelanggan</label>
                <input
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3]"
                  value={customerForm.full_name}
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      full_name: event.target.value
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Nomor WhatsApp</label>
                <input
                  required
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3]"
                  value={customerForm.phone_number}
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      phone_number: event.target.value
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Barber favorit (opsional)</label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all"
                  value={customerForm.preferred_barber_id}
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      preferred_barber_id: event.target.value
                    }))
                  }
                >
                  <option value="">Pilih barber favorit...</option>
                  {activeBarbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.full_name}
                      {barber.on_shift ? " • on shift" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Catatan</label>
                <textarea
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3] resize-none"
                  value={customerForm.notes}
                  onChange={(event) =>
                    setCustomerForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full py-3 bg-[#1A1A1A] hover:bg-black text-white rounded-xl font-bold transition-all disabled:opacity-70">
                  {isPending ? "Menyimpan..." : "Tambah ke CRM"}
                </button>
              </div>
            </fieldset>
          </form>
        </article>

        <article className="bg-[#1A1A1A] rounded-2xl shadow-xl p-6 lg:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <h2 className="text-xl font-bold text-white mb-6">Input kunjungan dari POS</h2>
          <form onSubmit={handleCreateVisit}>
            <fieldset className="flex flex-col gap-5 border-none p-0 m-0" disabled={isPending}>
              <div>
                <label className="text-sm font-semibold text-white/80 mb-1.5 block">Cari pelanggan aktif</label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-white/40"
                  placeholder="Cari nama atau nomor WA"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-white/80 mb-1.5 block">Pilih pelanggan yg sedang dikerjakan</label>
                <select
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-[#2A2A2A] text-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all"
                  value={visitForm.customer_id}
                  onChange={(event) => handleCustomerChange(event.target.value)}
                >
                  <option value="">Pilih pelanggan...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} • {customer.phone_number}
                    </option>
                  ))}
                </select>
              </div>

              {selectedQueueTicket ? (
                <div className="rounded-2xl border border-[#C8A464]/40 bg-[#2B2416] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#E9D2A3]">
                        Sedang memproses antrean #{selectedQueueTicket.queue_number}
                      </p>
                      <p className="mt-1 text-sm text-white">
                        {selectedQueueTicket.customer_name} • {selectedQueueTicket.source === "whatsapp" ? "Booking WhatsApp" : "Walk-in"}
                      </p>
                      <p className="mt-1 text-xs text-white/60">
                        Setelah kunjungan disimpan, tiket antrean ini akan otomatis ditandai selesai.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setVisitForm((current) => ({
                          ...current,
                          queue_ticket_id: "",
                        }))
                      }
                      className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/5"
                    >
                      Lepas
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="visit-service" className="text-sm font-semibold text-white/80 mb-1.5 block">Layanan</label>
                  <select
                    id="visit-service"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-[#2A2A2A] text-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all"
                    value={visitForm.service_id}
                    onChange={(event) => handleServiceChange(event.target.value)}
                  >
                    <option value="">Pilih layanan...</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} • {formatIDR(service.config.base_price_idr ?? 0)}
                        {service.config.duration_minutes ? ` • ${service.config.duration_minutes}m` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedService?.config.description ? (
                    <p className="mt-2 text-xs text-white/55">{selectedService.config.description}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="visit-barber" className="text-sm font-semibold text-white/80 mb-1.5 block">Barber</label>
                  <select
                    id="visit-barber"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-[#2A2A2A] text-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all"
                    value={visitForm.barber_id}
                    onChange={(event) => handleBarberChange(event.target.value)}
                  >
                    <option value="">Pilih barber...</option>
                    {activeBarbers.map((barber) => (
                      <option key={barber.id} value={barber.id}>
                        {barber.full_name}
                        {barber.on_shift ? " • on shift" : ""}
                      </option>
                    ))}
                  </select>
                  {selectedCustomer?.preferred_barber_id && selectedCustomer.preferred_barber_id === visitForm.barber_id ? (
                    <p className="mt-2 text-xs text-emerald-300">Barber ini adalah favorit pelanggan.</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-semibold text-white/80 mb-1.5 block">Nominal Pembayaran</label>
                  <input
                    required
                    inputMode="numeric"
                    className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-white/40 font-mono"
                    placeholder="50000"
                    value={visitForm.amount_idr}
                    onChange={(event) =>
                      setVisitForm((current) => ({
                        ...current,
                        amount_idr: event.target.value
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white/80 mb-1.5 block">Status pembayaran</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-[#2A2A2A] text-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all font-semibold"
                    value={visitForm.payment_status}
                    onChange={(event) =>
                      setVisitForm((current) => ({
                        ...current,
                        payment_status: event.target.value
                      }))
                    }
                  >
                    <option value="paid">Lunas (Paid)</option>
                    <option value="unpaid">Belum Lunas (Unpaid)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="visit-station" className="text-sm font-semibold text-white/80 mb-1.5 block">Kursi / station</label>
                  <select
                    id="visit-station"
                    className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-[#2A2A2A] text-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all"
                    value={visitForm.station_id}
                    onChange={(event) =>
                      setVisitForm((current) => ({ ...current, station_id: event.target.value }))
                    }
                  >
                    <option value="">Pilih kursi...</option>
                    {activeStations.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-white/80 mb-1.5 block">Setup WA Reminder H+</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-[#2A2A2A] text-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all"
                    value={visitForm.reminder_days}
                    onChange={(event) =>
                      setVisitForm((current) => ({
                        ...current,
                        reminder_days: event.target.value
                      }))
                    }
                  >
                    <option value="0">Tanpa reminder otomatis</option>
                    <option value="14">14 hari kemudian</option>
                    <option value="21">21 hari kemudian</option>
                    <option value="28">28 hari kemudian</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">Ringkasan layanan</p>
                  <p className="text-sm font-semibold text-white">{selectedService?.name ?? "Belum pilih layanan"}</p>
                  <p className="text-xs text-white/60 mt-1">
                    {selectedService?.config.duration_minutes
                      ? `Estimasi durasi ${selectedService.config.duration_minutes} menit`
                      : "Durasi mengikuti pengaturan layanan."}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-white/80 mb-1.5 block">Catatan Operasional</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-white/40"
                    placeholder="Buzz cut + wash"
                    value={visitForm.notes}
                    onChange={(event) =>
                      setVisitForm((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full py-3.5 bg-[#C8A464] hover:bg-[#B89454] text-white rounded-xl font-bold transition-all shadow-md shadow-[#C8A464]/20 disabled:opacity-70">
                  {isPending ? "Menyimpan..." : "Simpan & Jadwalkan Reminder"}
                </button>
              </div>
            </fieldset>
          </form>
        </article>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <article className="bg-white rounded-2xl border border-[#F0EDE8] shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#F0EDE8] bg-[#FCFBFA]">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Customer CRM terkini</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-white">
                  <th className="px-5 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Nama & Tgl</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">WA</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Barber</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider text-right">Visit/Spend</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#F0EDE8]">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-[#FCFBFA] transition-colors">
                    <td className="px-5 py-4">
                      <strong className="text-sm font-bold text-[#1A1A1A] block">{customer.full_name}</strong>
                      <div className="text-xs text-[#6B6B6B] mt-1">{formatDate(customer.last_visit_at)}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#1A1A1A] font-mono">{customer.phone_number}</td>
                    <td className="px-5 py-4 text-sm text-[#6B6B6B]">{customer.preferred_barber || "-"}</td>
                    <td className="px-5 py-4 text-right">
                      <strong className="text-sm font-bold text-[#1A1A1A] block">{customer.total_visits}x</strong>
                      <div className="text-xs text-[#6B6B6B] mt-1">{formatIDR(customer.total_spent_idr)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-[#F0EDE8] shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#F0EDE8] bg-[#FCFBFA]">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Daftar Kunjungan Aktif</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-white">
                  <th className="px-5 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Pelanggan</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Layanan</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Status / Harga</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Queue Reminder</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#F0EDE8]">
                {visits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-[#FCFBFA] transition-colors">
                    <td className="px-5 py-4">
                      <strong className="text-sm font-bold text-[#1A1A1A] block">{visit.customer_name}</strong>
                      <div className="text-xs text-[#6B6B6B] mt-1">{formatDate(visit.visit_at)}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[#1A1A1A] font-semibold">{visit.service_name}</span>
                      <div className="text-xs text-[#A3A3A3] mt-1">by {visit.barber_name || "-"}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-bold text-[#1A1A1A] block">{formatIDR(visit.amount_idr)}</span>
                      <div className="text-xs mt-1 uppercase font-bold tracking-wider">
                         {visit.payment_status === "paid" 
                           ? <span className="text-emerald-600">LUNAS</span> 
                           : <span className="text-amber-600">UNPAID</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-[#6B6B6B] bg-[#FFFBF0] border-l border-[#F0EDE8]">
                      {visit.next_reminder_at ? (
                        <>📦 Antre: {formatDate(visit.next_reminder_at)}</>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </TenantShell>
  );
}
