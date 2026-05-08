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
    const session = await barberaRequest("/api/v1/pos/auth/me", {
      token: accessToken,
    });

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Session POS tidak dapat dimuat.",
      },
      { status: 401 },
    );
  }
}
