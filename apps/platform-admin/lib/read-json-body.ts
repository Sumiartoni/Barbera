export async function readJSONBody(request: Request) {
  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }

  return JSON.parse(raw.trim()) as Record<string, unknown>;
}
