import { NextRequest, NextResponse } from "next/server";

import { platformRequest } from "../../../../lib/platform-api";
import { readJSONBody } from "../../../../lib/read-json-body";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ planCode: string }> },
) {
  try {
    const { planCode } = await context.params;
    const body = await readJSONBody(request);
    const data = await platformRequest(`/api/v1/platform/plans/${planCode}`, {
      method: "PUT",
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui paket." },
      { status: 500 },
    );
  }
}
