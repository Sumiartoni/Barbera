import { NextResponse } from "next/server";

import { platformRequest } from "../../../lib/platform-api";

export async function GET() {
  try {
    const data = await platformRequest("/api/v1/platform/overview");
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat overview platform." },
      { status: 500 },
    );
  }
}
