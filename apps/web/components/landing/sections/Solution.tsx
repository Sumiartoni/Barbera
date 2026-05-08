"use client";
import { Check, Sparkles } from "lucide-react";
import { Reveal, Tilt } from "@/components/landing/Reveal";

const Solution = () => (
  <section className="py-24 lg:py-36 bg-background relative overflow-hidden">
    <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px] -translate-y-1/2" />
    <div className="container relative">
      <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
        <Reveal direction="right">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-primary uppercase mb-5">
            <span className="w-8 h-px bg-primary" /> Solusinya
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-balance">
            Satu dashboard.{" "}
            <span className="text-gradient-red">Semua kebutuhan</span>{" "}
            barbershop kamu.
          </h2>
          <p className="mt-7 text-lg text-muted-foreground leading-relaxed text-pretty">
            Barbera dirancang khusus untuk barbershop. Bukan sekadar kasir,
            tapi sistem manajemen bisnis lengkap yang bantu kamu tumbuh lebih cepat.
          </p>

          <ul className="mt-9 space-y-4">
            {[
              "Transaksi tercatat otomatis & rapi",
              "Database pelanggan terintegrasi loyalty",
              "Booking online tanpa double booking",
              "Laporan harian real-time di satu layar",
              "Pantau performa setiap barber",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3.5">
                <span className="mt-0.5 w-6 h-6 rounded-full bg-gradient-red grid place-items-center shrink-0 shadow-glow">
                  <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />
                </span>
                <span className="font-medium text-base">{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal direction="left" delay={0.15}>
          <div className="relative perspective-1000">
            <Tilt max={10}>
              <div
                className="relative rounded-3xl bg-gradient-dark p-8 shadow-floating border border-white/5 noise"
                style={{ transform: "perspective(1200px) rotateY(-8deg) rotateX(4deg)" }}
              >
                <div className="absolute -top-3 -right-3 bg-gradient-red text-primary-foreground rounded-full px-3.5 py-1.5 text-xs font-bold flex items-center gap-1 shadow-glow animate-pulse-glow z-10">
                  <Sparkles className="w-3 h-3" /> All-in-One
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {["POS", "Booking", "Customer", "Staff", "Service", "Report"].map((label) => (
                    <div
                      key={label}
                      className="glass-dark rounded-xl p-5 text-center hover:bg-primary/20 transition-all group cursor-default"
                    >
                      <div className="font-display text-2xl font-extrabold text-white tracking-tight group-hover:text-gradient-red">{label}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-[0.2em] mt-1">Module</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 glass-dark rounded-xl p-5">
                  <div className="flex justify-between text-xs text-white/60 mb-2.5">
                    <span className="font-semibold">Barbera Score</span>
                    <span className="text-primary font-bold">98/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-red rounded-full" style={{ width: "98%" }} />
                  </div>
                </div>
              </div>
            </Tilt>
            {/* glow */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-primary/40 blur-[80px] rounded-full -z-10" />
          </div>
        </Reveal>
      </div>
    </div>
  </section>
);

export default Solution;
