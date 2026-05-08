import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { barberaRequest } from "@/lib/barbera-api";

type POSSession = {
  staff: {
    barber_id: string;
    full_name: string;
  };
  tenant: {
    id: string;
  };
};

type CustomerRecord = {
  id: string;
  full_name: string;
  phone_number: string;
};

type QueueTicket = {
  id: string;
  queue_number: number;
  customer_name: string;
};

function fallbackPhone() {
  const stamp = Date.now().toString().slice(-8);
  return `walkin-${stamp}`;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("pos_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Session POS belum tersedia." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const session = await barberaRequest<POSSession>("/api/v1/pos/auth/me", {
      token: accessToken,
    });

    const customerName = String(payload.customer_name ?? "").trim();
    const phone = String(payload.phone ?? "").trim() || fallbackPhone();
    const notes = String(payload.notes ?? "").trim();
    const selectedServices = Array.isArray(payload.services)
      ? payload.services
          .map((item: { label?: string }) => String(item?.label ?? "").trim())
          .filter(Boolean)
      : [];

    if (!customerName || selectedServices.length === 0) {
      return NextResponse.json(
        { error: "Nama pelanggan dan minimal satu layanan wajib diisi." },
        { status: 400 },
      );
    }

    const customersResponse = await barberaRequest<{ customers: CustomerRecord[] }>(
      `/api/v1/customers?limit=5&q=${encodeURIComponent(phone)}`,
      { token: accessToken },
    );

    let customer =
      customersResponse.customers.find(
        (entry) => entry.phone_number.toLowerCase() === phone.toLowerCase(),
      ) ?? null;

    if (!customer) {
      customer = await barberaRequest<CustomerRecord>("/api/v1/customers", {
        method: "POST",
        token: accessToken,
        body: {
          full_name: customerName,
          phone_number: phone,
          preferred_barber_id: session.staff.barber_id,
          notes,
        },
      });
    }

    const queueTicket = await barberaRequest<QueueTicket>("/api/v1/queue", {
      method: "POST",
      token: accessToken,
      body: {
        customer_id: customer.id,
        preferred_barber_id: session.staff.barber_id,
        assigned_barber_id: session.staff.barber_id,
        source: "walk_in",
        service_summary: selectedServices.join(", "),
        notes,
      },
    });

    return NextResponse.json({
      queue_ticket: queueTicket,
      customer,
      assigned_barber_name: session.staff.full_name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan transaksi." },
      { status: 500 },
    );
  }
}
