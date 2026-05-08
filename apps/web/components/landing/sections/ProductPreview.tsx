"use client";
import { TrendingUp, Calendar, Users, Scissors, ArrowUpRight, MoreHorizontal, Search, Bell, Settings, LayoutDashboard, ShoppingCart, FileBarChart, UserCircle2 } from "lucide-react";
import { Reveal, Tilt } from "@/components/landing/Reveal";

const ProductPreview = () => (
  <section id="product" className="py-24 lg:py-36 bg-background relative overflow-hidden">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-primary/5 rounded-full blur-[140px]" />
    <div className="absolute inset-0 grid-bg pointer-events-none" />
    <div className="container relative">
      <Reveal className="text-center max-w-2xl mx-auto mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-primary uppercase mb-5">
          <span className="w-8 h-px bg-primary" /> Product Preview <span className="w-8 h-px bg-primary" />
        </span>
        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance leading-[1.05]">
          Dashboard yang <span className="text-gradient-red">simpel & powerful</span>
        </h2>
        <p className="mt-5 text-lg text-muted-foreground">
          Real-time data untuk setiap keputusan bisnis kamu â€” dari satu layar.
        </p>
      </Reveal>

      <Reveal direction="up" delay={0.15}>
        <div className="relative max-w-6xl mx-auto perspective-2000">
          <Tilt max={4}>
            <div
              className="relative rounded-[2rem] bg-gradient-dark p-3 md:p-4 shadow-floating border border-white/10"
              style={{ transform: "perspective(2000px) rotateX(6deg)" }}
            >
              {/* browser bar */}
              <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <div className="ml-4 flex-1 max-w-md mx-auto bg-white/5 rounded-md px-3 py-1 text-[11px] text-white/50 font-mono text-center">
                  app.barbera.id/dashboard
                </div>
              </div>

              <div className="bg-background rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 min-h-[480px]">
                  {/* sidebar */}
                  <aside className="col-span-12 md:col-span-2 border-r border-border/60 p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-6 px-2">
                      <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-red shadow-glow">
                        <Scissors className="w-3.5 h-3.5 text-primary-foreground" />
                      </span>
                      <span className="font-display font-extrabold text-sm tracking-tight">Barbera</span>
                    </div>
                    <div className="space-y-1">
                      {[
                        { i: LayoutDashboard, l: "Dashboard", a: true },
                        { i: ShoppingCart, l: "POS" },
                        { i: Calendar, l: "Booking" },
                        { i: UserCircle2, l: "Customer" },
                        { i: Users, l: "Staff" },
                        { i: FileBarChart, l: "Reports" },
                      ].map(({ i: Icon, l, a }) => (
                        <div
                          key={l}
                          className={`flex items-center gap-2 text-xs font-semibold px-2.5 py-2 rounded-lg ${
                            a ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">{l}</span>
                        </div>
                      ))}
                    </div>
                  </aside>

                  {/* main */}
                  <div className="col-span-12 md:col-span-10 p-5 md:p-6 space-y-4">
                    {/* topbar */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-[11px] text-muted-foreground">Selamat datang kembali</div>
                        <div className="font-display font-bold text-base tracking-tight">Bagas Pratama ðŸ‘‹</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="hidden md:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
                          <Search className="w-3 h-3" /> Cari customer...
                        </div>
                        <button className="w-8 h-8 rounded-lg bg-muted grid place-items-center relative">
                          <Bell className="w-3.5 h-3.5" />
                          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                        </button>
                        <button className="w-8 h-8 rounded-lg bg-muted grid place-items-center">
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* stat row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { l: "Revenue Today", v: "Rp 4.28M", c: "+18%", i: TrendingUp, hl: true },
                        { l: "Total Booking", v: "47", c: "+5", i: Calendar },
                        { l: "Active Customer", v: "1,284", c: "+12%", i: Users },
                        { l: "Best Service", v: "Fade Cut", c: "142x", i: Scissors },
                      ].map((s) => (
                        <div
                          key={s.l}
                          className={`rounded-xl border p-4 ${
                            s.hl ? "bg-gradient-dark text-white border-secondary" : "border-border/60 bg-card"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <s.i className={`w-4 h-4 ${s.hl ? "text-primary" : "text-primary"}`} />
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              s.hl ? "bg-primary/20 text-primary" : "text-emerald-600 bg-emerald-50"
                            }`}>{s.c}</span>
                          </div>
                          <div className="text-xl font-extrabold tracking-tight">{s.v}</div>
                          <div className={`text-[10px] mt-0.5 ${s.hl ? "text-white/60" : "text-muted-foreground"}`}>{s.l}</div>
                        </div>
                      ))}
                    </div>

                    <div className="grid lg:grid-cols-3 gap-3">
                      {/* chart */}
                      <div className="lg:col-span-2 rounded-xl border border-border/60 p-5 bg-card">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <div className="text-sm font-bold">Sales Overview</div>
                            <div className="text-xs text-muted-foreground">Last 7 days Â· Rp 24.5M total</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-primary/10 text-primary">Week</span>
                            <span className="text-[10px] font-bold px-2 py-1 rounded text-muted-foreground">Month</span>
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="flex items-end gap-2 h-36 relative">
                          {/* gridlines */}
                          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            {[0,1,2,3].map(i => <div key={i} className="border-t border-dashed border-border/40" />)}
                          </div>
                          {[55, 72, 48, 85, 62, 91, 78].map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 relative z-10">
                              <div className="text-[9px] font-bold text-muted-foreground">{["1.8M","2.4M","1.6M","2.8M","2.0M","3.0M","2.6M"][i]}</div>
                              <div className="w-full rounded-t-lg bg-gradient-to-t from-primary/20 via-primary/60 to-primary relative overflow-hidden" style={{ height: `${h}%` }}>
                                <div className="absolute inset-x-0 top-0 h-1 bg-white/40" />
                              </div>
                              <span className="text-[9px] text-muted-foreground font-semibold">{["S","M","T","W","T","F","S"][i]}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* staff */}
                      <div className="rounded-xl border border-border/60 p-5 bg-card">
                        <div className="flex justify-between items-center mb-4">
                          <div className="text-sm font-bold">Top Barbers</div>
                          <span className="text-[10px] text-muted-foreground">Today</span>
                        </div>
                        {[
                          { n: "Reza", v: "Rp 1.2M", p: 92 },
                          { n: "Bagas", v: "Rp 980K", p: 78 },
                          { n: "Yoga", v: "Rp 720K", p: 64 },
                        ].map((s, i) => (
                          <div key={s.n} className="py-2 border-b border-border/40 last:border-0">
                            <div className="flex items-center gap-3 mb-1.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-red text-[10px] font-bold text-primary-foreground grid place-items-center shadow-glow">{i+1}</div>
                              <div className="flex-1 text-xs font-semibold">{s.n}</div>
                              <div className="text-xs font-bold">{s.v}</div>
                            </div>
                            <div className="h-1 rounded-full bg-muted overflow-hidden ml-10">
                              <div className="h-full bg-gradient-red" style={{ width: `${s.p}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* recent */}
                    <div className="rounded-xl border border-border/60 p-5 bg-card">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-sm font-bold">Recent Transactions</div>
                        <button className="text-xs text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all">View all <ArrowUpRight className="w-3 h-3" /></button>
                      </div>
                      <div className="space-y-1">
                        {[
                          { c: "Andi P.", s: "Fade Cut + Beard", b: "Reza", v: "Rp 95K", st: "Paid" },
                          { c: "Rian S.", s: "Hair Color", b: "Bagas", v: "Rp 250K", st: "Paid" },
                          { c: "Doni W.", s: "Mohawk", b: "Yoga", v: "Rp 75K", st: "Paid" },
                        ].map((r) => (
                          <div key={r.c} className="grid grid-cols-5 items-center text-xs py-2 border-b border-border/30 last:border-0">
                            <div className="flex items-center gap-2 col-span-2">
                              <div className="w-6 h-6 rounded-full bg-muted text-[10px] font-bold grid place-items-center">{r.c[0]}</div>
                              <span className="font-semibold">{r.c}</span>
                            </div>
                            <span className="text-muted-foreground">{r.s}</span>
                            <span className="text-muted-foreground">{r.b}</span>
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">{r.st}</span>
                              <span className="font-bold">{r.v}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tilt>

          {/* glow */}
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-primary/40 blur-[100px] rounded-full -z-10" />
        </div>
      </Reveal>
    </div>
  </section>
);

export default ProductPreview;
