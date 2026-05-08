"use client";

export async function clientRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(data?.error ?? "Terjadi kesalahan saat menghubungi server POS.");
  }

  return data as T;
}
