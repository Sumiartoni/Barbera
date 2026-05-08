import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { barberaRequest } from "@/lib/barbera-api";

type Context = {
  params: Promise<{ ticketId: string }>;
};

export async function POST(request: Request, context: Context) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("pos_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Session POS belum tersedia." }, { status: 401 });
  }

  const { ticketId } = await context.params;

  try {
    const payload = await request.json();
    const ticket = await barberaRequest(`/api/v1/queue/${ticketId}/status`, {
      method: "POST",
      token: accessToken,
      body: payload,
    });
    return NextResponse.json(ticket);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui status antrean." },
      { status: 500 },
    );
  }
}
