"use client";

import { useEffect, useState } from "react";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  isDeveloper?: boolean;
};

const CACHE_KEY = "ap:me-cache:v2";
const CACHE_TTL_MS = 5 * 60 * 1000;

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { ts: number; user: CurrentUser };
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL_MS && parsed.user) {
            if (!cancelled) {
              setUser(parsed.user);
              setLoading(false);
            }
          }
        }
      } catch {}

      const res = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (cancelled) return;

      if (data?.user) {
        const next: CurrentUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          avatarUrl: data.user.avatarUrl ?? null,
          isDeveloper: Boolean(data.user.isDeveloper),
        };
        setUser(next);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), user: next }));
        } catch {}
      }
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading };
}
