import { NextRequest, NextResponse } from "next/server";

import { platformRequest } from "../../../../../lib/platform-api";
import { readJSONBody } from "../../../../../lib/read-json-body";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ resourceType: string; itemId: string }> },
) {
  try {
    const { resourceType, itemId } = await context.params;
    const body = await readJSONBody(request);
    const data = await platformRequest(`/api/v1/platform/resources/${resourceType}/${itemId}`, {
      method: "PUT",
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui resource platform." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ resourceType: string; itemId: string }> },
) {
  try {
    const { resourceType, itemId } = await context.params;
    const data = await platformRequest(`/api/v1/platform/resources/${resourceType}/${itemId}`, {
      method: "DELETE",
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus resource platform." },
      { status: 500 },
    );
  }
}
