import { NextRequest, NextResponse } from "next/server";

import { platformRequest } from "../../../lib/platform-api";
import { readJSONBody } from "../../../lib/read-json-body";

export async function GET() {
  try {
    const data = await platformRequest("/api/v1/platform/tenants?limit=20");
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat tenant platform." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJSONBody(request);
    const tenantID = String(body.tenant_id ?? "").trim();
    const action = String(body.action ?? "").trim();

    if (!tenantID) {
      return NextResponse.json({ error: "Tenant ID wajib diisi." }, { status: 400 });
    }

    const endpoint =
      action === "status" || body.status
        ? `/api/v1/platform/tenants/${tenantID}/status`
        : `/api/v1/platform/tenants/${tenantID}/plan`;

    const data = await platformRequest(endpoint, { method: "POST", body });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui tenant." },
      { status: 500 },
    );
  }
}
