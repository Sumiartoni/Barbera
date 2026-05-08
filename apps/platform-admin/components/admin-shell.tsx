"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart,
  Building2,
  CheckSquare,
  CreditCard,
  DollarSign,
  Key,
  LayoutDashboard,
  LifeBuoy,
  LogIn,
  Menu,
  MessageCircle,
  Package,
  Receipt,
  Search,
  Settings,
  Shield,
  Sliders,
  Ticket,
  ToggleLeft,
  UserCog,
  UserX,
  Wrench,
} from "lucide-react";

import {
  adminNavSections,
  getAdminNavItem,
  type AdminNavItem,
  type AdminSectionId,
} from "../lib/admin-navigation";

function renderIcon(sectionId: AdminSectionId) {
  switch (sectionId) {
    case "overview":
      return <LayoutDashboard size={18} />;
    case "tenants":
    case "tenant-detail":
      return <Building2 size={18} />;
    case "tenant-override":
    case "security-settings":
      return <Settings size={18} />;
    case "suspension":
      return <Shield size={18} />;
    case "plans":
      return <Package size={18} />;
    case "pricing":
      return <CreditCard size={18} />;
    case "coupons":
      return <Ticket size={18} />;
    case "subscriptions":
    case "invoices":
      return <Receipt size={18} />;
    case "payments":
      return <DollarSign size={18} />;
    case "manual-confirmation":
      return <CheckSquare size={18} />;
    case "usage-metering":
      return <BarChart size={18} />;
    case "quota-limits":
      return <Sliders size={18} />;
    case "feature-flags":
      return <ToggleLeft size={18} />;
    case "access-control":
      return <Key size={18} />;
    case "admin-users":
      return <UserCog size={18} />;
    case "wa-health":
      return <MessageCircle size={18} />;
    case "system-status":
      return <Activity size={18} />;
    case "audit-logs":
      return <Shield size={18} />;
    case "incident-logs":
      return <AlertTriangle size={18} />;
    case "blocked-tenants":
      return <UserX size={18} />;
    case "login-activity":
      return <LogIn size={18} />;
    case "support":
      return <LifeBuoy size={18} />;
    case "announcements":
      return <MessageCircle size={18} />;
    case "maintenance":
      return <Wrench size={18} />;
    default:
      return <LayoutDashboard size={18} />;
  }
}

function findActiveItem(pathname: string): AdminNavItem | null {
  const normalized = pathname === "/internal-admin" ? "/internal-admin/overview" : pathname;

  for (const section of adminNavSections) {
    const match = section.items.find((item) => item.href === normalized);
    if (match) {
      return match;
    }
  }

  return getAdminNavItem("overview");
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("barbera-platform-sidebar-collapsed");
    if (saved === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  const activeItem = useMemo(() => findActiveItem(pathname), [pathname]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("barbera-platform-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <main className="flex h-screen bg-zinc-950 text-zinc-50 overflow-hidden">
      <aside
        className={`flex flex-col bg-zinc-900/50 border-r border-zinc-800/50 transition-all duration-300 z-20 ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800/50 h-16 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-lg flex items-center justify-center shrink-0 border border-zinc-700/50">
            B
          </div>
          {!sidebarCollapsed ? (
            <div className="flex flex-col overflow-hidden whitespace-nowrap">
              <span className="font-bold text-zinc-100 leading-tight tracking-wide">BARBERA</span>
              <span className="text-xs text-zinc-500 font-medium">Internal Admin</span>
            </div>
          ) : null}
        </div>

        {!sidebarCollapsed ? (
          <div className="px-4 py-4 shrink-0">
            <Link
              href="/login"
              className="flex items-center justify-center w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-semibold text-sm transition-all border border-zinc-700/50"
            >
              Kelola Akses Internal
            </Link>
          </div>
        ) : null}

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {adminNavSections.map((section) => (
            <div key={section.label} className="space-y-1">
              {!sidebarCollapsed ? (
                <p className="px-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">
                  {section.label}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const baseClasses = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                    sidebarCollapsed ? "justify-center" : ""
                  }`;

                  const stateClasses = isActive
                    ? "bg-zinc-800 text-white border border-zinc-700/60"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent";

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`${baseClasses} ${stateClasses}`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className="shrink-0">{renderIcon(item.id)}</span>
                      {!sidebarCollapsed ? (
                        <span className="truncate flex-1">{item.label}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 w-full">
        <header className="h-16 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-md border-b border-zinc-800/50 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={toggleSidebar}
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="hidden md:flex relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="search"
                placeholder="Cari tenant, invoice, atau incident..."
                readOnly
                className="w-full pl-10 pr-4 py-2 border border-zinc-800 rounded-full text-sm bg-zinc-900/50 focus:outline-none focus:border-zinc-700 text-zinc-300"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-zinc-100">
                {activeItem?.label ?? "Internal Admin"}
              </span>
              <span className="text-xs text-zinc-500 font-medium">Super Admin • Barbera Core</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#C8A464] text-black flex items-center justify-center font-bold text-sm shrink-0">
              BA
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full">
          <div className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full">{children}</div>
        </div>
      </section>
    </main>
  );
}
