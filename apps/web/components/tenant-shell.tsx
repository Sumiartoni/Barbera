"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, type SessionState } from "../lib/session";
import { apiRequest } from "../lib/api";

import {
  LogOut,
  LayoutDashboard,
  MonitorSmartphone,
  Users,
  UserCheck,
  Scissors,
  Store,
  CalendarDays,
  Clock,
  History,
  ReceiptText,
  BellRing,
  Megaphone,
  Gift,
  Target,
  UserX,
  MessageCircle,
  FileText,
  Inbox,
  Send,
  BarChart3,
  TrendingUp,
  PieChart,
  BadgeDollarSign,
  Star,
  ShieldCheck,
  CreditCard,
  Gauge,
  PlugZap,
  ClipboardList,
  Settings,
  HelpCircle,
  ListRestart,
  Menu,
  Search,
} from "lucide-react";

type TenantShellProps = {
  session: SessionState;
  title: string;
  description: string;
  children: React.ReactNode;
  active: string;
  actions?: React.ReactNode;
};

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  upcoming?: boolean;
};

type PermissionKey =
  | "dashboard"
  | "customers"
  | "visits"
  | "queue"
  | "barbers"
  | "shifts"
  | "billing"
  | "whatsapp"
  | "reports"
  | "settings";

type RoleKey = "owner" | "admin" | "cashier" | "barber";

type PermissionMatrix = Record<RoleKey, Record<PermissionKey, boolean>>;

type BillingSummary = {
  allow_campaigns: boolean;
  allow_loyalty: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "Core",
    items: [
      { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} />, href: "/dashboard" },
      { id: "customers", label: "Pelanggan CRM", icon: <Users size={18} />, href: "/customers" },
      { id: "visits", label: "Kunjungan", icon: <History size={18} />, href: "/visits" },
      { id: "queue", label: "Antrian / Booking", icon: <Clock size={18} />, href: "/queue" }
    ]
  },
  {
    label: "Operasional",
    items: [
      { id: "barbers", label: "Barber", icon: <Scissors size={18} />, href: "/barbers" },
      { id: "stations", label: "Kursi / Station", icon: <Store size={18} />, href: "/stations" },
      { id: "services", label: "Layanan", icon: <ListRestart size={18} />, href: "/services" },
      { id: "outlets", label: "Outlet", icon: <Store size={18} />, href: "/outlets" },
      { id: "shifts", label: "Jadwal & Shift", icon: <CalendarDays size={18} />, href: "/shifts" },
      { id: "pos", label: "Akses POS Barber", icon: <MonitorSmartphone size={18} />, href: "/pos" },
      { id: "payments-history", label: "Riwayat Pembayaran", icon: <BadgeDollarSign size={18} />, href: "/payments-history" },
      { id: "invoices", label: "Invoice", icon: <ReceiptText size={18} />, href: "/invoices" }
    ]
  },
  {
    label: "Retention",
    items: [
      { id: "reminder-rules", label: "Reminder Rules", icon: <BellRing size={18} />, href: "/reminder-rules" },
      { id: "reminder-queue", label: "Reminder Queue", icon: <Clock size={18} />, href: "/reminder-queue" },
      { id: "campaigns", label: "Campaigns", icon: <Megaphone size={18} />, href: "/campaigns" },
      { id: "loyalty", label: "Loyalty & Membership", icon: <Gift size={18} />, href: "/loyalty" },
      { id: "segments", label: "Segmen Pelanggan", icon: <Target size={18} />, href: "/segments" },
      { id: "dormant", label: "Pelanggan Tidur", icon: <UserX size={18} />, href: "/dormant" }
    ]
  },
  {
    label: "Channel",
    items: [
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle size={18} />, href: "/whatsapp" },
      { id: "templates", label: "Template Pesan", icon: <FileText size={18} />, href: "/templates" },
      { id: "inbox", label: "Inbox / Balasan", icon: <Inbox size={18} />, href: "/inbox" },
      { id: "broadcast", label: "Broadcast History", icon: <Send size={18} />, href: "/broadcast" }
    ]
  },
  {
    label: "Analitik",
    items: [
      { id: "daily-report", label: "Laporan Harian", icon: <BarChart3 size={18} />, href: "/daily-report" },
      { id: "repeat-customer", label: "Repeat Customer", icon: <UserCheck size={18} />, href: "/repeat-customer" },
      { id: "retention-report", label: "Retention", icon: <TrendingUp size={18} />, href: "/retention-report" },
      { id: "revenue", label: "Omzet", icon: <PieChart size={18} />, href: "/revenue" },
      { id: "barber-performance", label: "Performa Barber", icon: <Star size={18} />, href: "/barber-performance" }
    ]
  },
  {
    label: "Manajemen",
    items: [
      { id: "roles", label: "Tim & Role", icon: <Users size={18} />, href: "/roles" },
      { id: "permissions", label: "Permission", icon: <ShieldCheck size={18} />, href: "/permissions" },
      { id: "billing", label: "Billing & Subscription", icon: <CreditCard size={18} />, href: "/billing" },
      { id: "usage", label: "Usage & Limits", icon: <Gauge size={18} />, href: "/usage" },
      { id: "integrations", label: "Integrations", icon: <PlugZap size={18} />, href: "/integrations" },
      { id: "audit", label: "Audit Log", icon: <ClipboardList size={18} />, href: "/audit" },
      { id: "settings", label: "Settings", icon: <Settings size={18} />, href: "/settings" }
    ]
  },
  {
    label: "Support",
    items: [
      { id: "help", label: "Bantuan", icon: <HelpCircle size={18} />, href: "/help" },
      { id: "changelog", label: "Changelog", icon: <ListRestart size={18} />, href: "/changelog" }
    ]
  }
];

const navPermissionMap: Partial<Record<string, PermissionKey>> = {
  dashboard: "dashboard",
  customers: "customers",
  visits: "visits",
  queue: "queue",
  services: "barbers",
  barbers: "barbers",
  stations: "barbers",
  outlets: "barbers",
  shifts: "shifts",
  pos: "queue",
  "payments-history": "billing",
  invoices: "billing",
  "reminder-rules": "whatsapp",
  "reminder-queue": "whatsapp",
  campaigns: "whatsapp",
  loyalty: "settings",
  segments: "reports",
  dormant: "reports",
  whatsapp: "whatsapp",
  templates: "whatsapp",
  inbox: "whatsapp",
  broadcast: "whatsapp",
  "daily-report": "reports",
  "repeat-customer": "reports",
  "retention-report": "reports",
  revenue: "reports",
  "barber-performance": "reports",
  roles: "settings",
  permissions: "settings",
  billing: "billing",
  usage: "billing",
  integrations: "settings",
  audit: "settings",
  settings: "settings",
};

function createDefaultMatrix(): PermissionMatrix {
  return {
    owner: {
      dashboard: true,
      customers: true,
      visits: true,
      queue: true,
      barbers: true,
      shifts: true,
      billing: true,
      whatsapp: true,
      reports: true,
      settings: true,
    },
    admin: {
      dashboard: true,
      customers: true,
      visits: true,
      queue: true,
      barbers: true,
      shifts: true,
      billing: false,
      whatsapp: true,
      reports: true,
      settings: false,
    },
    cashier: {
      dashboard: true,
      customers: true,
      visits: true,
      queue: true,
      barbers: false,
      shifts: false,
      billing: false,
      whatsapp: false,
      reports: false,
      settings: false,
    },
    barber: {
      dashboard: false,
      customers: false,
      visits: false,
      queue: true,
      barbers: false,
      shifts: true,
      billing: false,
      whatsapp: false,
      reports: false,
      settings: false,
    },
  };
}

function normalizeMatrix(raw: Record<string, unknown> | null | undefined): PermissionMatrix {
  const base = createDefaultMatrix();
  if (!raw) return base;
  for (const role of Object.keys(base) as RoleKey[]) {
    const rawRole = raw[role];
    if (!rawRole || typeof rawRole !== "object") continue;
    for (const permission of Object.keys(base[role]) as PermissionKey[]) {
      const value = (rawRole as Record<string, unknown>)[permission];
      if (typeof value === "boolean") {
        base[role][permission] = value;
      }
    }
  }
  return base;
}

export function TenantShell({
  session,
  title,
  description,
  children,
  active,
  actions
}: TenantShellProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [permissions, setPermissions] = useState<PermissionMatrix>(createDefaultMatrix());
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const initials = session.user.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    const saved = window.localStorage.getItem("barbera-tenant-sidebar-collapsed");
    if (saved === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    let cancelled = false;
    void (async () => {
      try {
        const [permissionPayload, billingPayload] = await Promise.all([
          apiRequest<{ config: Record<string, unknown> }>("/api/v1/config/permissions", {
            token: session.access_token,
          }),
          apiRequest<BillingSummary>("/api/v1/billing/summary", {
            token: session.access_token,
          }),
        ]);
        if (cancelled) return;
        setPermissions(normalizeMatrix(permissionPayload.config));
        setBillingSummary(billingPayload);
      } catch {
        if (cancelled) return;
        setPermissions(createDefaultMatrix());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session.access_token]);

  const currentRole = (session.user.role || "owner").toLowerCase() as RoleKey;

  function isPlanLocked(itemId: string) {
    if (!billingSummary) return false;
    if (itemId === "campaigns") {
      return !billingSummary.allow_campaigns;
    }
    if (itemId === "loyalty") {
      return !billingSummary.allow_loyalty;
    }
    return false;
  }

  function canAccessItem(itemId: string) {
    if (currentRole === "owner") {
      return true;
    }
    const permissionKey = navPermissionMap[itemId];
    if (!permissionKey) {
      return true;
    }
    return Boolean(permissions[currentRole]?.[permissionKey]);
  }

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.upcoming && canAccessItem(item.id) && !isPlanLocked(item.id)),
    }))
    .filter((section) => section.items.length > 0);

  const activeAllowed = canAccessItem(active) && !isPlanLocked(active);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("barbera-tenant-sidebar-collapsed", String(next));
      return next;
    });
  }

  function handleLogout() {
    clearSession();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="flex h-screen bg-[#FAF8F5] overflow-hidden text-[#1A1A1A]">
      <aside
        className={`flex flex-col bg-white border-r border-[#F0EDE8] transition-all duration-300 z-20 ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 p-4 border-b border-[#F0EDE8] h-16 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#C8A464]/10 text-[#C8A464] font-bold text-lg flex items-center justify-center shrink-0">
            B
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col overflow-hidden whitespace-nowrap">
              <span className="font-bold text-[#1A1A1A] leading-tight">Barbera</span>
              <span className="text-xs text-[#6B6B6B]">Owner OS</span>
            </div>
          )}
        </div>

        {/* Primary Action */}
        {!sidebarCollapsed && (
          <div className="px-4 py-4 shrink-0">
            <Link
              href="/queue"
              className="flex items-center justify-center w-full py-2.5 bg-[#C8A464] hover:bg-[#B89454] text-white rounded-lg font-semibold text-sm transition-all shadow-sm"
            >
              + Pantau Antrian
            </Link>
          </div>
        )}

        {/* Navigation Map */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6 scrollbar-thin scrollbar-thumb-[#E5E5E5] scrollbar-track-transparent">
          {visibleSections.map((section) => (
            <div key={section.label} className="space-y-1">
              {!sidebarCollapsed && (
                <p className="px-3 text-xs font-bold tracking-wider text-[#A3A3A3] uppercase mb-2">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = active === item.id;
                  const itemClasses = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative ${
                    isActive
                      ? "bg-[#C8A464]/10 text-[#C8A464]"
                      : item.upcoming
                      ? "text-[#A3A3A3] opacity-70 cursor-not-allowed"
                      : "text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A]"
                  } ${sidebarCollapsed ? "justify-center" : ""}`;

                  const content = (
                    <>
                      <span className={`shrink-0 ${isActive ? "text-[#C8A464]" : "text-[#A3A3A3] group-hover:text-[#1A1A1A] transition-colors"}`}>
                        {item.icon}
                      </span>
                      {!sidebarCollapsed && (
                        <>
                          <span className="truncate flex-1">{item.label}</span>
                          {item.upcoming && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#F5F5F5] text-[#A3A3A3] border border-[#E5E5E5] rounded uppercase">
                              Soon
                            </span>
                          )}
                        </>
                      )}
                    </>
                  );

                  return item.href && !item.upcoming ? (
                    <Link key={item.id} href={item.href} className={itemClasses} title={sidebarCollapsed ? item.label : undefined}>
                      {content}
                    </Link>
                  ) : (
                    <span key={item.id} className={itemClasses} title={sidebarCollapsed ? item.label : undefined}>
                      {content}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Account */}
        <div className="p-4 border-t border-[#F0EDE8] flex items-center gap-3 shrink-0 bg-[#FCFBFA]">
          <div className="w-10 h-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-sm shrink-0">
            {initials || "B"}
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <span className="text-sm font-bold text-[#1A1A1A] truncate">{session.user.full_name}</span>
              <span className="text-xs text-[#6B6B6B] uppercase font-semibold">{session.plan_code}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 w-full">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-[#F0EDE8] shrink-0 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={toggleSidebar}
              className="p-2 text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F5F5] rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="hidden md:flex relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]" size={18} />
              <input
                type="search"
                placeholder="Cari..."
                readOnly
                className="w-full pl-10 pr-4 py-2 border border-[#E5E5E5] rounded-full text-sm bg-[#FCFBFA] focus:outline-none focus:border-[#C8A464]"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-[#1A1A1A]">{session.user.full_name}</span>
              <span className="text-xs text-[#6B6B6B] font-medium tracking-wide">
                {session.user.role.toUpperCase()} &bull; {session.plan_code.toUpperCase()}
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-sm shrink-0">
              {initials || "B"}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm font-semibold text-[#6B6B6B] hover:text-[#C8A464] transition-colors ml-2"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-[#E5E5E5]/50 pb-6">
              <div>
                <p className="text-sm font-semibold text-[#C8A464] mb-1 tracking-wide uppercase">
                  Memantau performa {session.tenant.name}
                </p>
                <h1 className="text-3xl font-extrabold text-[#1A1A1A] tracking-tight">{title}</h1>
                <p className="text-[#6B6B6B] mt-2">{description}</p>
              </div>
              {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
            </div>

            {/* Main Yield */}
            <div>
              {activeAllowed ? (
                children
              ) : (
                <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
                  <h2 className="text-lg font-bold">Akses modul dibatasi</h2>
                  <p className="mt-2 text-sm">
                    Role <strong>{session.user.role}</strong> tidak memiliki izin untuk membuka menu ini, atau fitur ini
                    belum tersedia di paket aktif Anda.
                  </p>
                  <p className="mt-2 text-sm">
                    Owner bisa mengubah izin dari menu <strong>Permission</strong> atau upgrade paket dari menu{" "}
                    <strong>Billing & Subscription</strong>.
                  </p>
                </section>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
