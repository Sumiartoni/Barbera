import { TrendingUp, Calendar, Users, Scissors, Star } from "lucide-react";

export const RevenueCard = () => (
  <div className="glass rounded-2xl p-4 shadow-floating w-56">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-muted-foreground">Revenue Hari Ini</span>
      <TrendingUp className="w-4 h-4 text-primary" />
    </div>
    <div className="text-2xl font-extrabold tracking-tight">Rp 4.280K</div>
    <div className="text-xs text-emerald-600 font-semibold mt-1">+18.2% vs kemarin</div>
    <div className="mt-3 flex items-end gap-1 h-8">
      {[40, 65, 50, 80, 60, 90, 75].map((h, i) => (
        <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-primary/30 to-primary" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);

export const BookingCard = () => (
  <div className="glass rounded-2xl p-4 shadow-floating w-60">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-medium text-muted-foreground">Booking Schedule</span>
      <Calendar className="w-4 h-4 text-primary" />
    </div>
    {[
      { t: "10:00", n: "Andi P.", s: "Fade Cut" },
      { t: "11:30", n: "Rian S.", s: "Beard Trim" },
      { t: "13:00", n: "Doni W.", s: "Mohawk" },
    ].map((b) => (
      <div key={b.t} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
        <div className="text-[10px] font-bold text-primary w-10">{b.t}</div>
        <div className="flex-1">
          <div className="text-xs font-semibold">{b.n}</div>
          <div className="text-[10px] text-muted-foreground">{b.s}</div>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </div>
    ))}
  </div>
);

export const CustomerCard = () => (
  <div className="glass rounded-2xl p-4 shadow-floating w-52">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-muted-foreground">Customer Database</span>
      <Users className="w-4 h-4 text-primary" />
    </div>
    <div className="text-2xl font-extrabold">1.284</div>
    <div className="text-xs text-muted-foreground mt-1">Member Aktif</div>
    <div className="flex -space-x-2 mt-3">
      {["A", "R", "D", "M"].map((l, i) => (
        <div key={i} className="w-7 h-7 rounded-full bg-gradient-red text-[10px] font-bold text-primary-foreground grid place-items-center border-2 border-background">
          {l}
        </div>
      ))}
      <div className="w-7 h-7 rounded-full bg-secondary text-primary-foreground text-[10px] font-bold grid place-items-center border-2 border-background">
        +9
      </div>
    </div>
  </div>
);

export const StaffCard = () => (
  <div className="glass rounded-2xl p-4 shadow-floating w-56">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-medium text-muted-foreground">Staff Performance</span>
      <Star className="w-4 h-4 text-primary" />
    </div>
    {[
      { n: "Reza", v: 92 },
      { n: "Bagas", v: 78 },
      { n: "Yoga", v: 64 },
    ].map((s) => (
      <div key={s.n} className="mb-2 last:mb-0">
        <div className="flex justify-between text-[11px] font-semibold mb-1">
          <span>{s.n}</span><span className="text-muted-foreground">{s.v}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-gradient-red" style={{ width: `${s.v}%` }} />
        </div>
      </div>
    ))}
  </div>
);

export const ServiceCard = () => (
  <div className="glass rounded-2xl p-4 shadow-floating w-52">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-medium text-muted-foreground">Layanan Populer</span>
      <Scissors className="w-4 h-4 text-primary" />
    </div>
    {[
      { n: "Fade Cut", c: 142 },
      { n: "Beard Trim", c: 98 },
      { n: "Hair Color", c: 64 },
    ].map((s) => (
      <div key={s.n} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
        <span className="text-xs font-semibold">{s.n}</span>
        <span className="text-[10px] font-bold text-primary">{s.c}x</span>
      </div>
    ))}
  </div>
);
