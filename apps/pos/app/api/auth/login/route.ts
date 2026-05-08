import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { barberaRequest } from "@/lib/barbera-api";

type POSLoginResult = {
  access_token: string;
  expires_at: string;
  staff: {
    id: string;
    barber_id: string;
    full_name: string;
    role: string;
    access_code: string;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    public_queue_id: string;
    public_queue_url: string;
  };
};

export async function POST(request: Request) {
  try {
    const { accessCode, pin } = await request.json();
    if (!accessCode || !pin) {
      return NextResponse.json(
        { error: "Kode akses dan PIN wajib diisi." },
        { status: 400 },
      );
    }

    const session = await barberaRequest<POSLoginResult>("/api/v1/pos/auth/login", {
      method: "POST",
      body: {
        access_code: accessCode,
        pin,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set("pos_access_token", session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return NextResponse.json({
      staff: session.staff,
      tenant: session.tenant,
      expires_at: session.expires_at,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Login POS gagal diproses.",
      },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("pos_access_token");
  return NextResponse.json({ success: true });
}
