"use client";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/landing/ui/button";
import { Reveal } from "@/components/landing/Reveal";

const FinalCTA = () => (
  <section className="py-24 lg:py-32 bg-background">
    <div className="container">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-dark p-12 md:p-20 text-center noise border border-white/5">
          <div className="absolute inset-0 grid-bg-dark opacity-40" />
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-primary/35 rounded-full blur-[120px]" />
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px]" />

          <div className="relative max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 glass-dark rounded-full px-4 py-1.5 mb-7 text-xs font-semibold text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Aktif & berjalan di 2.500+ outlet
            </span>
            <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-[-0.03em] text-white leading-[1.02] text-balance">
              Saatnya Barbershop Kamu{" "}
              <span className="text-gradient-red">Lebih Rapi, Modern, dan Profesional</span>
            </h2>
            <p className="mt-8 text-white/70 text-lg max-w-xl mx-auto leading-relaxed">
              Gabung 2.500+ barbershop yang sudah upgrade operasional mereka dengan Barbera.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="hero" size="xl" className="group">
                Mulai dengan Barbera
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="glass" size="xl" className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white">
                Lihat Demo
              </Button>
            </div>
            <p className="mt-7 text-xs text-white/50 tracking-wide">Gratis 14 hari Â· Tanpa kartu kredit Â· Setup 2 menit</p>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

export default FinalCTA;
