import { Star, Quote } from "lucide-react";
import t1 from "@/assets/testimonial-1.jpg";
import t2 from "@/assets/testimonial-2.jpg";
import t3 from "@/assets/testimonial-3.jpg";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";

const testimonials = [
  { img: t1, name: "Bagas Pratama", role: "Owner, Kapten Barbershop", text: "Setelah pakai Barbera, laporan harian langsung jadi otomatis. Bisa fokus servis customer, bukan ngitung struk lagi." },
  { img: t2, name: "Reza Aditya", role: "Owner, Sharp Cuts Studio", text: "Booking online jadi rapi, double booking hilang total. Customer juga makin loyal karena ada sistem membernya." },
  { img: t3, name: "Yoga Santoso", role: "Owner, The Gentleman Barber", text: "Gua bisa pantau performa barber, omzet harian, sama service paling laku — semua dari HP. Worth banget." },
];

const stats = [
  { v: "2.500+", l: "Barbershop aktif" },
  { v: "1.2 Jt+", l: "Transaksi/bulan" },
  { v: "98%", l: "Customer satisfaction" },
  { v: "4.9/5", l: "Rating App Store" },
];

const Testimonials = () => (
  <section id="testimonials" className="py-24 lg:py-36 bg-background relative">
    <div className="container">
      <Reveal className="text-center max-w-2xl mx-auto mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-primary uppercase mb-5">
          <span className="w-8 h-px bg-primary" /> Testimoni <span className="w-8 h-px bg-primary" />
        </span>
        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
          Dipercaya oleh <span className="text-gradient-red">2.500+ barbershop</span>
        </h2>
      </Reveal>

      <Stagger className="grid md:grid-cols-3 gap-6 mb-16" stagger={0.1}>
        {testimonials.map((t, i) => (
          <StaggerItem key={t.name}>
            <figure
              className={`relative rounded-3xl p-8 card-lift h-full ${
                i === 1 ? "bg-gradient-dark text-secondary-foreground border border-primary/30 noise" : "bg-card border border-border/60"
              }`}
            >
              <Quote className={`absolute top-6 right-6 w-10 h-10 ${i === 1 ? "text-primary/30" : "text-primary/15"}`} />
              <div className="flex gap-0.5 mb-5">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <blockquote className="text-base leading-relaxed mb-7 relative z-10 text-pretty">
                "{t.text}"
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <img src={t.img} alt={t.name} loading="lazy" width={512} height={512} className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/30" />
                <div>
                  <div className="font-display font-bold text-sm tracking-tight">{t.name}</div>
                  <div className={`text-xs ${i === 1 ? "text-white/60" : "text-muted-foreground"}`}>{t.role}</div>
                </div>
              </figcaption>
            </figure>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto pt-10 border-t border-border">
          {stats.map((s) => (
            <div key={s.l} className="text-center">
              <div className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-gradient-red">{s.v}</div>
              <div className="text-xs text-muted-foreground mt-1.5 font-medium">{s.l}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  </section>
);

export default Testimonials;
