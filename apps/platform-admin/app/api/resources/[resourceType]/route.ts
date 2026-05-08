import { NextRequest, NextResponse } from "next/server";

import { platformRequest } from "../../../../lib/platform-api";
import { readJSONBody } from "../../../../lib/read-json-body";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ resourceType: string }> },
) {
  try {
    const { resourceType } = await context.params;
    const data = await platformRequest(`/api/v1/platform/resources/${resourceType}`);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat resource platform." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resourceType: string }> },
) {
  try {
    const { resourceType } = await context.params;
    const body = await readJSONBody(request);
    const data = await platformRequest(`/api/v1/platform/resources/${resourceType}`, {
      method: "POST",
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat resource platform." },
      { status: 500 },
    );
  }
}
