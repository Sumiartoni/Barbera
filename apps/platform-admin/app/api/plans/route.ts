import { NextRequest, NextResponse } from "next/server";

import { platformRequest } from "../../../lib/platform-api";
import { readJSONBody } from "../../../lib/read-json-body";

export async function GET() {
  try {
    const data = await platformRequest("/api/v1/platform/plans");
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat paket platform." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJSONBody(request);
    const planCode = String(body.plan_code ?? "").trim();

    if (!planCode) {
      return NextResponse.json({ error: "Plan code wajib diisi." }, { status: 400 });
    }

    const data = await platformRequest(`/api/v1/platform/plans/${planCode}`, {
      method: "PUT",
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui paket platform." },
      { status: 500 },
    );
  }
}
