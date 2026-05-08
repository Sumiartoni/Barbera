"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Email dan password wajib diisi");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        throw new Error("Gagal login");
      }

      router.replace("/internal-admin");
      router.refresh();
    } catch {
      setError("Gagal login ke panel admin. Periksa kembali kredensial Anda.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-[#FAF8F5]">
      {/* Left Hero Section - Hidden on Mobile */}
      <section className="hidden lg:flex flex-1 flex-col justify-center px-16 xl:px-24 border-r border-[#F0EDE8] bg-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C8A464]/5 rounded-bl-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#1A1A1A]/5 rounded-tr-full -ml-16 -mb-16"></div>
        
        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-bold tracking-widest text-[#C8A464] uppercase mb-4">BARBERA Internal Access</p>
          <h1 className="text-4xl xl:text-5xl font-bold text-[#1A1A1A] leading-tight mb-6">
            Panel super admin untuk kendali penuh platform.
          </h1>
          <p className="text-lg text-[#6B6B6B] mb-12 leading-relaxed">
            Gunakan halaman ini untuk masuk ke workspace internal BARBERA. Anda
            bisa memantau tenant, pricing, billing, feature flags, audit log, dan
            kesehatan sistem dari satu panel abstrak sentral.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <article className="p-6 rounded-2xl bg-[#FCFBFA] border border-[#F0EDE8] hover:border-[#C8A464]/30 transition-colors">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-2 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#C8A464]/10 text-[#C8A464] flex items-center justify-center text-sm">C</span>
                Kontrol Commercial
              </h3>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                Atur paket Free, Pro, Plus, harga variabel, coupon, dan tenant
                override dari satu tempat.
              </p>
            </article>
            <article className="p-6 rounded-2xl bg-[#FCFBFA] border border-[#F0EDE8] hover:border-[#C8A464]/30 transition-colors">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-2 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#1A1A1A]/5 text-[#1A1A1A] flex items-center justify-center text-sm">O</span>
                Kontrol Operasional
              </h3>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                Pantau abuse, queue, incident, session WhatsApp tenant, dan audit
                log platform.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Right Login Section */}
      <section className="flex-1 flex flex-col justify-center max-w-lg px-8 lg:px-16 w-full mx-auto relative z-10 bg-[#FAF8F5]">
        <div className="w-full max-w-sm mx-auto">
          {/* Brand */}
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-xl shadow-lg border border-white/10">
              BA
            </div>
            <div>
              <p className="font-bold text-xl text-[#1A1A1A] tracking-tight">BARBERA</p>
              <p className="text-xs text-[#6B6B6B] font-medium tracking-wide uppercase">Internal Workspace</p>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Masuk ke internal admin</h2>
            <p className="text-sm text-[#6B6B6B] leading-relaxed">
              Silakan masukkan kredensial administrator Anda untuk mengakses dashboard platform.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Email admin</label>
              <input
                type="email"
                required
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3]"
                placeholder="owner@barbera.my.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#1A1A1A] mb-1.5 block">Password internal</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-white focus:border-[#C8A464] focus:ring-1 focus:ring-[#C8A464] outline-none transition-all placeholder:text-[#A3A3A3] font-mono"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {error ? (
              <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm mt-4 font-medium">
                {error}
              </div>
            ) : null}

            <div className="pt-6 space-y-3">
              <button
                type="submit"
                className="w-full py-3.5 bg-[#C8A464] hover:bg-[#B89454] text-white rounded-xl font-bold transition-all shadow-md shadow-[#C8A464]/20 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  "Login ke Platform"
                )}
              </button>
            </div>

            <p className="text-xs text-center text-[#A3A3A3] mt-8 leading-relaxed px-4">
              Akses terbatas untuk platform engineers. Seluruh aktivitas akan direkam oleh <b className="text-[#6B6B6B]">Audit Log</b>.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
