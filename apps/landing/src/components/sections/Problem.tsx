import { motion } from "framer-motion";
import { AlertTriangle, FileX, CalendarX, DollarSign, UserX } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";

const problems = [
  { icon: FileX, title: "Catatan Transaksi Manual", desc: "Bon kertas hilang, salah hitung, susah direkap akhir hari." },
  { icon: UserX, title: "Data Pelanggan Hilang", desc: "Tidak ada riwayat layanan, sulit kasih treatment personal." },
  { icon: CalendarX, title: "Jadwal Booking Berantakan", desc: "Double booking, antrian numpuk, customer kecewa." },
  { icon: DollarSign, title: "Pendapatan Tidak Jelas", desc: "Bingung profit harian, sulit lihat tren bisnis." },
  { icon: AlertTriangle, title: "Kinerja Staff Sulit Dipantau", desc: "Tidak tahu barber siapa yang paling produktif." },
];

const Problem = () => (
  <section className="py-24 lg:py-36 bg-secondary text-secondary-foreground relative overflow-hidden noise">
    <div className="absolute inset-0 grid-bg-dark pointer-events-none" />
    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[140px]" />
    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />

    <div className="container relative">
      <Reveal className="max-w-2xl mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-primary uppercase mb-5">
          <span className="w-8 h-px bg-primary" /> Masalah Umum
        </span>
        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance leading-[1.05]">
          Operasional barbershop kamu masih{" "}
          <span className="text-gradient-red">manual & ribet?</span>
        </h2>
      </Reveal>

      <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {problems.map((p) => (
          <StaggerItem key={p.title}>
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="glass-dark rounded-2xl p-7 group h-full border border-white/5 hover:border-primary/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/15 grid place-items-center mb-5 group-hover:bg-gradient-red group-hover:scale-110 transition-all">
                <p.icon className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2 tracking-tight">{p.title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{p.desc}</p>
            </motion.div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  </section>
);

export default Problem;
