const apiBaseURL =
  process.env.BARBERA_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://[::1]:8080";

type RequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

export async function barberaRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers();
  headers.set("Accept", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let body: BodyInit | undefined;
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
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Request failed with ${response.status}`);
  }

  return data as T;
}
