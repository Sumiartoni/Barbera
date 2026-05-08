"use client";

import { useEffect, useState } from "react";

import { loadSession, syncSessionProfile, type SessionState } from "../lib/session";

export function useTenantSession() {
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    const initialSession = loadSession();
    setSession(initialSession);

    if (!initialSession?.access_token) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const refreshedSession = await syncSessionProfile();
      if (!cancelled && refreshedSession) {
        setSession(refreshedSession);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return session;
}
