const apiBaseURL =
  process.env.BARBERA_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://[::1]:8080";

const adminAPIKey = process.env.PLATFORM_ADMIN_API_KEY ?? "dev-platform-admin-key-change-me";

type PlatformRequestOptions = {
  method?: string;
  body?: unknown;
};

export async function platformRequest<T>(path: string, options: PlatformRequestOptions = {}) {
  const headers = new Headers({ Accept: "application/json", "X-Platform-Admin-Key": adminAPIKey });

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(new URL(path, apiBaseURL), {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });

  const raw = await response.text();
  const data = parseJSONPayload(raw);

  if (!response.ok) {
    const errorMessage =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "object" &&
      data.error !== null &&
      "message" in data.error &&
      typeof data.error.message === "string"
        ? data.error.message
        : `Request failed with ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

function parseJSONPayload(raw: string): unknown {
  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw.trim()) as Record<string, unknown>;
  } catch {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    const firstBracket = raw.indexOf("[");
    const lastBracket = raw.lastIndexOf("]");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    }

    if (firstBracket >= 0 && lastBracket > firstBracket) {
      return JSON.parse(raw.slice(firstBracket, lastBracket + 1)) as Record<string, unknown>;
    }

    throw new Error("Platform response is not valid JSON.");
  }
}
