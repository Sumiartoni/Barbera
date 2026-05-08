"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "../lib/api";
import { loadSession, saveSession, type SessionState } from "../lib/session";

type AuthMode = "login" | "register";

export function AuthPageClient({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });
  const [registerForm, setRegisterForm] = useState({
    barbershop_name: "",
    full_name: "",
    email: "",
    phone_number: "",
    password: ""
  });

  useEffect(() => {
    const session = loadSession();
    if (session?.access_token) {
      const requestedPlan = searchParams.get("plan");
      const requestedCycle = searchParams.get("cycle");
      if (requestedPlan && requestedPlan !== "free" && session.plan_code !== requestedPlan) {
        const nextBillingURL = requestedCycle
          ? `/billing?plan=${encodeURIComponent(requestedPlan)}&cycle=${encodeURIComponent(requestedCycle)}`
          : `/billing?plan=${encodeURIComponent(requestedPlan)}`;
        router.replace(nextBillingURL);
        return;
      }
      router.replace(nextPath || "/dashboard");
    }
  }, [nextPath, router, searchParams]);

  // Auto-switch to register tab if URL has ?tab=register
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "register") {
      setMode("register");
    }
  }, [searchParams]);

  function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(() => {
      void submitAuth("/api/v1/auth/login", loginForm);
    });
  }

  function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(() => {
      void submitAuth("/api/v1/auth/register", registerForm);
    });
  }

  async function submitAuth(path: string, payload: Record<string, string>) {
    try {
      const result = await apiRequest<SessionState>(path, {
        method: "POST",
        body: payload
      });

      saveSession(result);
      const requestedPlan = searchParams.get("plan");
      const requestedCycle = searchParams.get("cycle");
      if (requestedPlan && requestedPlan !== "free" && result.plan_code !== requestedPlan) {
        const nextBillingURL = requestedCycle
          ? `/billing?plan=${encodeURIComponent(requestedPlan)}&cycle=${encodeURIComponent(requestedCycle)}`
          : `/billing?plan=${encodeURIComponent(requestedPlan)}`;
        router.replace(nextBillingURL);
      } else {
        router.replace(nextPath || "/dashboard");
      }
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat menghubungi server."
      );
    }
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 relative z-10">
      <section className="bg-white rounded-3xl shadow-2xl border border-[#F0EDE8] p-8 sm:p-10 max-w-[440px] w-full mx-auto animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-12 h-12 bg-[#C8A464]/10 text-[#C8A464] rounded-xl flex items-center justify-center font-bold text-xl mb-4">
            B
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-[#1A1A1A] leading-tight">Barbera</h1>
            <p className="text-sm text-[#6B6B6B] mt-0.5">
              Owner Operating System
            </p>
          </div>
        </div>

        <div className="flex bg-[#F5F5F5] p-1 rounded-xl mb-8">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
              mode === "login" 
                ? "bg-white text-[#1A1A1A] shadow-sm" 
                : "text-[#6B6B6B] hover:text-[#1A1A1A]"
            }`}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
              mode === "register" 
                ? "bg-white text-[#1A1A1A] shadow-sm" 
                : "text-[#6B6B6B] hover:text-[#1A1A1A]"
            }`}
            onClick={() => setMode("register")}
          >
            Register Tenant
          </button>
        </div>

        {error ? (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm mb-6 text-center">
            {error}
          </div>
        ) : null}

        {mode === "login" ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <fieldset className="flex flex-col gap-4 border-none p-0 m-0" disabled={isPending}>
              <div>
                <label htmlFor="login-email" className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Email owner</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3]"
                  placeholder="owner@barbershop.com"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>
              <div>
                <label htmlFor="login-password" className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Password</label>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3]"
                  placeholder="Minimal 8 karakter"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full py-3.5 bg-[#C8A464] hover:bg-[#B89454] text-white rounded-xl font-semibold transition-all shadow-md shadow-[#C8A464]/20 disabled:opacity-70"
                >
                  {isPending ? "Memproses..." : "Masuk ke Dashboard"}
                </button>
              </div>
            </fieldset>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <fieldset className="flex flex-col gap-4 border-none p-0 m-0" disabled={isPending}>
              <div>
                <label htmlFor="register-barbershop-name" className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Nama barbershop</label>
                <input
                  id="register-barbershop-name"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3]"
                  placeholder="Barbershop Sultan"
                  value={registerForm.barbershop_name}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      barbershop_name: event.target.value
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="register-full-name" className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Nama owner</label>
                <input
                  id="register-full-name"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3]"
                  placeholder="Nama lengkap owner"
                  value={registerForm.full_name}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, full_name: event.target.value }))
                  }
                />
              </div>
              <div>
                <label htmlFor="register-email" className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Email owner</label>
                <input
                  id="register-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3]"
                  placeholder="owner@barbershop.com"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>
              <div>
                <label htmlFor="register-phone-number" className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Nomor WhatsApp owner</label>
                <input
                  id="register-phone-number"
                  type="tel"
                  required
                  autoComplete="tel"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3]"
                  placeholder="08xxxxxxxxxx"
                  value={registerForm.phone_number}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      phone_number: event.target.value
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="register-password" className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Password</label>
                <input
                  id="register-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FCFBFA] focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3]"
                  placeholder="Minimal 8 karakter"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full py-3.5 bg-[#C8A464] hover:bg-[#B89454] text-white rounded-xl font-semibold transition-all shadow-md shadow-[#C8A464]/20 disabled:opacity-70"
                >
                  {isPending ? "Membuat tenant..." : "Buat Tenant dan Masuk"}
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </section>
    </main>
  );
}
