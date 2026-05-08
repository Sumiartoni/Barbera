"use client";
import { Reveal, Stagger, StaggerItem } from "@/components/landing/Reveal";

const steps = [
  { n: "01", t: "Daftarkan Barbershop", d: "Buat akun gratis dalam 2 menit, isi profil bisnis kamu." },
  { n: "02", t: "Tambahkan Layanan & Staff", d: "Input katalog layanan, harga, dan barber kamu." },
  { n: "03", t: "Mulai Catat Transaksi", d: "Booking & transaksi langsung tercatat otomatis." },
  { n: "04", t: "Pantau dari Dashboard", d: "Lihat laporan & insights bisnis kapan pun." },
];

const HowItWorks = () => (
  <section className="py-24 lg:py-36 bg-muted/40 relative overflow-hidden">
    <div className="container">
      <Reveal className="text-center max-w-2xl mx-auto mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-primary uppercase mb-5">
          <span className="w-8 h-px bg-primary" /> How it Works <span className="w-8 h-px bg-primary" />
        </span>
        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
          Mulai pakai dalam <span className="text-gradient-red">4 langkah</span>
        </h2>
      </Reveal>

      <Stagger className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 relative" stagger={0.12}>
        <div className="hidden lg:block absolute top-10 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        {steps.map((s) => (
          <StaggerItem key={s.n}>
            <div className="relative text-center group">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-gradient-red rounded-2xl rotate-6 group-hover:rotate-12 transition-transform duration-500 shadow-glow" />
                <div className="relative w-full h-full bg-card border border-border rounded-2xl grid place-items-center font-display text-2xl font-extrabold text-gradient-red">
                  {s.n}
                </div>
              </div>
              <h3 className="font-display font-bold text-lg mb-2 tracking-tight">{s.t}</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">{s.d}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  </section>
);

export default HowItWorks;
