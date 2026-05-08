import { NextRequest, NextResponse } from "next/server";

import { platformRequest } from "../../../../lib/platform-api";
import { readJSONBody } from "../../../../lib/read-json-body";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ configType: string }> },
) {
  try {
    const { configType } = await context.params;
    const data = await platformRequest(`/api/v1/platform/config/${configType}`);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat konfigurasi platform." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ configType: string }> },
) {
  try {
    const { configType } = await context.params;
    const body = await readJSONBody(request);
    const data = await platformRequest(`/api/v1/platform/config/${configType}`, {
      method: "PUT",
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan konfigurasi platform." },
      { status: 500 },
    );
  }
}
