import { Zap, Heart, Award, FileBarChart, Repeat } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";

const benefits = [
  { icon: Zap, title: "Operasional Lebih Cepat", desc: "Transaksi & booking 3x lebih cepat dari cara manual." },
  { icon: Heart, title: "Customer Lebih Loyal", desc: "Treatment personal dengan riwayat lengkap pelanggan." },
  { icon: Award, title: "Bisnis Terlihat Profesional", desc: "Receipt digital, booking online, image meningkat." },
  { icon: FileBarChart, title: "Laporan Harian Mudah", desc: "Tutup buku otomatis, langsung lihat profit harian." },
  { icon: Repeat, title: "Repeat Customer Naik", desc: "Sistem loyalty bantu customer balik lebih sering." },
];

const Benefits = () => (
  <section className="py-24 lg:py-36 bg-background relative overflow-hidden">
    <div className="container">
      <div className="grid lg:grid-cols-12 gap-12">
        <Reveal className="lg:col-span-4 lg:sticky lg:top-32 lg:self-start" direction="right">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-primary uppercase mb-5">
            <span className="w-8 h-px bg-primary" /> Benefits
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-balance">
            Kenapa barbershop pilih{" "}
            <span className="text-gradient-red">Barbera?</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-pretty leading-relaxed">
            Lebih dari sekadar POS — Barbera bantu kamu naik kelas jadi bisnis yang
            terstruktur, profesional, dan siap berkembang.
          </p>
        </Reveal>

        <Stagger className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
          {benefits.map((b) => (
            <StaggerItem key={b.title}>
              <div className="bg-card border border-border/60 rounded-2xl p-6 card-lift flex gap-4 h-full hover:border-primary/30 group">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-red-soft border border-primary/10 grid place-items-center group-hover:bg-gradient-red transition-all">
                  <b.icon className="w-5 h-5 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <div>
                  <h3 className="font-display font-bold mb-1 tracking-tight">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  </section>
);

export default Benefits;
