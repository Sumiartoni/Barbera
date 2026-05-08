import { NextRequest, NextResponse } from "next/server";

import { platformRequest } from "../../../../../lib/platform-api";
import { readJSONBody } from "../../../../../lib/read-json-body";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const body = await readJSONBody(request);
    const data = await platformRequest(`/api/v1/platform/billing-orders/${orderId}/status`, {
      method: "POST",
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui status order paket." },
      { status: 500 },
    );
  }
}
