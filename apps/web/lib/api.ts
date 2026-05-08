import { webConfig } from "./config";

type APIRequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

export function apiURL(path: string) {
  return new URL(path, webConfig.apiBaseURL).toString();
}

export async function apiRequest<T>(
  path: string,
  options: APIRequestOptions = {}
) {
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

  const response = await fetch(apiURL(path), {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store"
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Request failed with ${response.status}`);
  }

  return data as T;
}
