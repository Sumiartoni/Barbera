import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { barberaRequest } from "@/lib/barbera-api";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("pos_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Session POS belum tersedia." }, { status: 401 });
  }

  try {
    const visits = await barberaRequest("/api/v1/visits?limit=20", {
      token: accessToken,
    });
    return NextResponse.json(visits);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat riwayat." },
      { status: 500 },
    );
  }
}
