import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const apiBaseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_PUBLIC_URL ??
  "http://[::1]:8080";

export async function GET() {
  try {
    const response = await fetch(new URL("/api/v1/public/plans", apiBaseURL), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : { plans: [] };

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.error?.message ??
            payload?.error ??
            "Gagal memuat paket publik BARBERA.",
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Gagal menghubungi API BARBERA.",
      },
      { status: 500 },
    );
  }
}
