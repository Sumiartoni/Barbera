import {
  CreditCard, CalendarCheck, UserCircle, Tags,
  UsersRound, QrCode, BarChart3, Crown
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";

const features = [
  { icon: CreditCard, title: "POS Cashier", desc: "Sistem kasir cepat & intuitif untuk transaksi harian." },
  { icon: CalendarCheck, title: "Booking Management", desc: "Atur jadwal & antrian pelanggan otomatis." },
  { icon: UserCircle, title: "Customer Database", desc: "Profil pelanggan lengkap dengan riwayat layanan." },
  { icon: Tags, title: "Service & Pricing", desc: "Kelola katalog layanan dan harga dengan mudah." },
  { icon: UsersRound, title: "Staff Management", desc: "Atur jadwal, komisi, dan kinerja barber." },
  { icon: QrCode, title: "QRIS & Cash Tracking", desc: "Terima pembayaran QRIS dan tunai dalam satu sistem." },
  { icon: BarChart3, title: "Daily Reports", desc: "Laporan penjualan harian real-time & detail." },
  { icon: Crown, title: "Loyalty & Membership", desc: "Bangun loyalitas pelanggan dengan poin & member." },
];

const Features = () => (
  <section id="features" className="py-24 lg:py-36 bg-muted/40 relative overflow-hidden">
    <div className="absolute inset-0 bg-mesh opacity-50 pointer-events-none" />
    <div className="container relative">
      <Reveal className="text-center max-w-2xl mx-auto mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-primary uppercase mb-5">
          <span className="w-8 h-px bg-primary" /> Fitur Lengkap <span className="w-8 h-px bg-primary" />
        </span>
        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance leading-[1.05]">
          Semua yang barbershop kamu <span className="text-gradient-red">butuhkan</span>
        </h2>
        <p className="mt-5 text-lg text-muted-foreground text-pretty">
          Dari kasir, booking, sampai laporan — semua sudah disiapkan dalam satu platform.
        </p>
      </Reveal>

      <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" stagger={0.06}>
        {features.map((f) => (
          <StaggerItem key={f.title}>
            <div className="group relative bg-card rounded-2xl p-7 border border-border/60 card-lift overflow-hidden h-full hover:border-primary/30">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10 group-hover:bg-primary/25 transition-all blur-2xl" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-red grid place-items-center mb-5 shadow-glow group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  <f.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2 tracking-tight">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  </section>
);

export default Features;
