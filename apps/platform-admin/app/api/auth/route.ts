import { NextRequest, NextResponse } from "next/server";

const adminEmail = process.env.PLATFORM_ADMIN_EMAIL ?? "admin@barbera.local";
const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD ?? "Admin#12345";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: "Email dan password wajib diisi." },
      { status: 400 },
    );
  }

  if (body.email !== adminEmail || body.password !== adminPassword) {
    return NextResponse.json(
      { error: "Kredensial internal tidak valid." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("platform_session", "active", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("platform_session");
  return response;
}
