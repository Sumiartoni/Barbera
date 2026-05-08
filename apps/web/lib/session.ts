export type SessionState = {
  access_token: string;
  token_type: string;
  expires_at: string;
  plan_code: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    phone_number: string;
    role: string;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    public_queue_id?: string;
  };
};

const STORAGE_KEY = "barbera_session_v1";

export function loadSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  document.cookie = "tenant_session=active; Path=/; SameSite=Lax";
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  document.cookie = "tenant_session=; Max-Age=0; Path=/; SameSite=Lax";
}

export async function syncSessionProfile() {
  if (typeof window === "undefined") {
    return null;
  }

  const current = loadSession();
  if (!current?.access_token) {
    return current;
  }

  const apiBaseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://[::1]:8080";

  try {
    const response = await fetch(new URL("/api/v1/auth/me", apiBaseURL), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${current.access_token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return current;
    }

    const profile = (await response.json()) as Omit<SessionState, "access_token" | "token_type" | "expires_at">;
    const nextSession: SessionState = {
      ...current,
      plan_code: profile.plan_code,
      user: profile.user,
      tenant: profile.tenant,
    };

    saveSession(nextSession);
    return nextSession;
  } catch {
    return current;
  }
}
