"use client";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/landing/ui/button";
import { Reveal, Stagger, StaggerItem } from "@/components/landing/Reveal";
import { useQuery } from "@tanstack/react-query";

interface Plan {
  code: string;
  name: string;
  description: string;
  is_free: boolean;
  monthly_price_idr: number;
  max_outlets: number;
  max_users: number;
  allow_campaigns: boolean;
  allow_loyalty: boolean;
  allow_exports: boolean;
  allow_multi_outlet: boolean;
}

const formatPrice = (price: number) => {
  if (price === 0) return "0";
  return (price / 1000).toString() + "K";
};

const getFeatures = (plan: Plan) => {
  const features = [];
  features.push(`${plan.max_outlets} Outlet`);
  features.push(plan.max_users > 10 ? "Unlimited Staff" : `${plan.max_users} Staff`);
  
  if (plan.is_free) {
    features.push("POS & Booking dasar", "Laporan harian", "Support email");
  } else if (plan.code === "pro") {
    features.push("Semua fitur POS", "QRIS & E-Wallet", "Laporan advanced", "Priority support");
  } else {
    features.push("Konsolidasi laporan", "API access", "Custom branding", "Dedicated manager");
  }

  if (plan.allow_loyalty) features.push("Membership & Loyalty");
  if (plan.allow_campaigns) features.push("Marketing Campaigns");
  
  return features;
};

const Pricing = () => {
  const appUrl = "";

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const url = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8081";
      const res = await fetch(`${url}/api/v1/public/plans`);
      if (!res.ok) throw new Error("Failed to fetch plans");
      const data = await res.json();
      return data.plans || [];
    }
  });

  return (
    <section id="pricing" className="py-24 lg:py-36 bg-muted/40 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh opacity-40 pointer-events-none" />
      <div className="container relative">
        <Reveal className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-primary uppercase mb-5">
            <span className="w-8 h-px bg-primary" /> Pricing <span className="w-8 h-px bg-primary" />
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Pilih paket yang <span className="text-gradient-red">paling pas</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">Coba gratis 14 hari. Tanpa kartu kredit.</p>
        </Reveal>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Stagger className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto" stagger={0.1}>
            {plans.map((p) => {
              const isPro = p.code === "pro";
              const ctaText = p.is_free ? "Mulai Gratis" : isPro ? "Pilih " + p.name : "Hubungi Sales";
              const registerUrl = p.code === "plus" ? `${appUrl}/contact` : `${appUrl}/register?plan=${p.code}`;

              return (
                <StaggerItem key={p.code}>
                  <div
                    className={`relative rounded-3xl p-8 transition-all h-full flex flex-col ${
                      isPro
                        ? "bg-gradient-dark text-secondary-foreground shadow-floating lg:scale-105 border border-primary/40 noise"
                        : "bg-card border border-border/60 card-lift"
                    }`}
                  >
                    {isPro && (
                      <>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-red text-primary-foreground text-xs font-bold rounded-full px-4 py-1.5 flex items-center gap-1 shadow-glow">
                          <Sparkles className="w-3 h-3" /> RECOMMENDED
                        </div>
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-primary/40 blur-[60px] rounded-full -z-10" />
                      </>
                    )}
                    <div className={`text-sm font-bold uppercase tracking-[0.2em] mb-3 ${isPro ? "text-primary" : "text-muted-foreground"}`}>
                      {p.name}
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-sm font-semibold">Rp</span>
                      <span className="font-display text-5xl md:text-6xl font-extrabold tracking-tighter">
                        {formatPrice(p.monthly_price_idr)}
                      </span>
                      <span className={`text-sm ${isPro ? "text-white/60" : "text-muted-foreground"}`}>/bulan</span>
                    </div>
                    <p className={`text-sm mb-7 leading-relaxed ${isPro ? "text-white/70" : "text-muted-foreground"}`}>
                      {p.description}
                    </p>

                    <Button
                      variant={isPro ? "hero" : "dark"}
                      size="lg"
                      className="w-full mb-7"
                      onClick={() => window.location.href = registerUrl}
                    >
                      {ctaText}
                    </Button>

                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${isPro ? "text-white/50" : "text-muted-foreground"}`}>
                      Termasuk
                    </div>
                    <ul className="space-y-3 mb-4 flex-grow">
                      {getFeatures(p).map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm">
                          <span className={`mt-0.5 w-4 h-4 rounded-full grid place-items-center shrink-0 ${isPro ? "bg-primary/20" : "bg-primary/10"}`}>
                            <Check className="w-2.5 h-2.5 text-primary" strokeWidth={3} />
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </div>
    </section>
  );
};

export default Pricing;
