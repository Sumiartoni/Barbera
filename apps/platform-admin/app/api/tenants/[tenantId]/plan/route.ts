import { NextRequest, NextResponse } from "next/server";

import { platformRequest } from "../../../../../lib/platform-api";
import { readJSONBody } from "../../../../../lib/read-json-body";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await context.params;
    const body = await readJSONBody(request);
    const data = await platformRequest(`/api/v1/platform/tenants/${tenantId}/plan`, {
      method: "POST",
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui paket tenant." },
      { status: 500 },
    );
  }
}
