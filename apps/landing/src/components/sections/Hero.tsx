import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Play, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-barber.jpg";
import { RevenueCard, BookingCard, StaffCard, ServiceCard } from "@/components/FloatingCards";
import BarberPole from "@/components/BarberPole";

const Hero = () => {
  const appUrl = import.meta.env.VITE_APP_URL || "http://localhost:3000";
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const yImage = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -80]);
  const yCard1 = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -160]);
  const yCard2 = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 100]);
  const yCard3 = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -200]);
  const yCard4 = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);
  const yPole = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -240]);
  const opacityFade = useTransform(scrollYProgress, [0, 0.7], [1, 0.4]);

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <section
      ref={ref}
      className="relative pt-28 lg:pt-36 pb-20 lg:pb-28 overflow-hidden bg-gradient-hero noise"
    >
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/25 rounded-full blur-[140px]" />
      <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[120px]" />

      {/* Animated barber pole - left decorative */}
      <motion.div
        style={{ y: yPole }}
        className="hidden xl:block absolute top-[35%] left-[2%] z-10 pointer-events-none"
      >
        <motion.div
          animate={reduce ? {} : { y: [0, -12, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <BarberPole size="lg" showGlow />
        </motion.div>
      </motion.div>

      {/* Second barber pole - right side decorative */}
      <motion.div
        style={{ y: useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -180]) }}
        className="hidden 2xl:block absolute top-[50%] right-[2%] z-10 pointer-events-none"
      >
        <motion.div
          animate={reduce ? {} : { y: [0, 10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <BarberPole size="md" showGlow />
        </motion.div>
      </motion.div>

      <div className="container relative">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT */}
          <motion.div
            style={{ opacity: opacityFade }}
            className="lg:col-span-6 relative z-10"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
              className="inline-flex items-center gap-2 glass rounded-full pl-1.5 pr-4 py-1.5 mb-7 shadow-soft"
            >
              <span className="bg-gradient-red text-primary-foreground text-[10px] font-bold rounded-full px-2 py-0.5 tracking-wider">
                NEW
              </span>
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold tracking-wide">
                POS #1 untuk Barbershop Modern
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease }}
              className="font-display text-[2.75rem] sm:text-5xl md:text-6xl lg:text-[4.25rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-balance"
            >
              POS Modern untuk{" "}
              <span className="relative inline-block">
                <span className="text-gradient-red">Barbershop</span>
                <motion.svg
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.2, delay: 0.9, ease }}
                  className="absolute -bottom-3 left-0 w-full"
                  viewBox="0 0 200 8"
                  fill="none"
                >
                  <motion.path
                    d="M2 5 Q 100 0 198 5"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </motion.svg>
              </span>{" "}
              yang Ingin Naik Level
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease }}
              className="mt-7 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed text-pretty"
            >
              Kelola booking, transaksi, pelanggan, staff, layanan, dan laporan
              harian dalam satu dashboard khusus barbershop.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45, ease }}
              className="mt-9 flex flex-col sm:flex-row gap-3"
            >
              <Button variant="hero" size="lg" className="group" onClick={() => window.location.href = `${appUrl}/register`}>
                Coba Gratis 14 Hari
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="glass" size="lg" className="group">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-secondary text-primary-foreground">
                  <Play className="w-3 h-3 fill-current" />
                </span>
                Lihat Demo Produk
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.7 }}
              className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {[
                    "from-amber-500 to-orange-600",
                    "from-rose-500 to-red-700",
                    "from-zinc-700 to-zinc-900",
                    "from-red-500 to-rose-700",
                  ].map((g, i) => (
                    <div
                      key={i}
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${g} border-2 border-background shadow-soft`}
                    />
                  ))}
                </div>
                <div className="text-sm">
                  <div className="font-bold tracking-tight">2.500+ Barbershop</div>
                  <div className="text-muted-foreground text-xs">
                    sudah pakai Barbera
                  </div>
                </div>
              </div>
              <div className="h-10 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-primary text-primary"
                    />
                  ))}
                </div>
                <div className="text-sm">
                  <span className="font-bold">4.9/5</span>{" "}
                  <span className="text-muted-foreground text-xs">
                    rating owner
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* RIGHT */}
          <div className="lg:col-span-6 relative perspective-2000 mt-4 lg:mt-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, rotateY: -14 }}
              animate={{ opacity: 1, scale: 1, rotateY: -6 }}
              transition={{ duration: 1.1, delay: 0.2, ease }}
              style={{ y: yImage, transformStyle: "preserve-3d" }}
              className="relative mx-auto max-w-md lg:max-w-none"
            >
              <div
                className="relative rounded-[2.25rem] overflow-hidden shadow-floating border border-border/40"
                style={{
                  transform: "rotateX(2deg)",
                  transformStyle: "preserve-3d",
                }}
              >
                <img
                  src={heroImg}
                  alt="Barber profesional bekerja di barbershop modern"
                  width={1024}
                  height={1280}
                  className="w-full h-[520px] sm:h-[580px] object-cover"
                  fetchPriority="high"
                />
                {/* gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-tr from-secondary/30 via-transparent to-primary/15" />
                <div className="absolute inset-0 bg-gradient-to-t from-secondary/85 via-secondary/10 to-transparent" />

                {/* corner brand chip */}
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                      Live di
                    </div>
                    <div className="font-display font-bold text-2xl">
                      Kapten Barbershop
                    </div>
                  </div>
                  <div className="glass-dark rounded-xl px-3 py-2 text-[10px] font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    24 booking aktif
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <motion.div
                style={{ y: yCard1 }}
                className="absolute -top-8 -left-6 md:-left-12 hidden sm:block"
              >
                <motion.div
                  animate={reduce ? {} : { y: [0, -10, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  style={{ rotate: "-4deg" }}
                >
                  <RevenueCard />
                </motion.div>
              </motion.div>

              <motion.div
                style={{ y: yCard2 }}
                className="absolute top-28 -right-4 md:-right-10 hidden sm:block"
              >
                <motion.div
                  animate={reduce ? {} : { y: [0, 12, 0] }}
                  transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  style={{ rotate: "3deg" }}
                >
                  <BookingCard />
                </motion.div>
              </motion.div>

              <motion.div
                style={{ y: yCard3 }}
                className="absolute -bottom-10 -left-4 md:-left-14 hidden md:block"
              >
                <motion.div
                  animate={reduce ? {} : { y: [0, -8, 0] }}
                  transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                  style={{ rotate: "-2deg" }}
                >
                  <ServiceCard />
                </motion.div>
              </motion.div>

              <motion.div
                style={{ y: yCard4 }}
                className="absolute -bottom-4 right-6 md:right-10 hidden md:block"
              >
                <motion.div
                  animate={reduce ? {} : { y: [0, 10, 0] }}
                  transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                  style={{ rotate: "4deg" }}
                >
                  <StaffCard />
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Glow under image */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-2/3 h-24 bg-primary/40 blur-[80px] rounded-full -z-10" />
          </div>
        </div>

        {/* Trusted by marquee */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-20 lg:mt-28"
        >
          <div className="text-center text-[11px] font-bold tracking-[0.3em] text-muted-foreground uppercase mb-6">
            Dipercaya barbershop di seluruh Indonesia
          </div>
          <div className="marquee-mask overflow-hidden">
            <div className="flex gap-14 animate-marquee whitespace-nowrap">
              {[
                "KAPTEN", "SHARP CUTS", "GENTLEMAN", "RAZOR&CO",
                "BLADE STUDIO", "FADE LAB", "URBAN CUTS", "TONSORIAL",
                "KAPTEN", "SHARP CUTS", "GENTLEMAN", "RAZOR&CO",
                "BLADE STUDIO", "FADE LAB", "URBAN CUTS", "TONSORIAL",
              ].map((b, i) => (
                <span
                  key={i}
                  className="font-display text-2xl font-extrabold text-foreground/30 tracking-tight hover:text-foreground/60 transition-colors"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
