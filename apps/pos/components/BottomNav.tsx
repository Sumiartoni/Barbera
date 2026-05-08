"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    id: "nav-home",
    href: "/",
    label: "Beranda",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          stroke={active ? "var(--gold)" : "currentColor"}
          strokeWidth="1.8"
          fill={active ? "rgba(201,168,76,0.12)" : "none"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M9 21V12h6v9" stroke={active ? "var(--gold)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "nav-transaction",
    href: "/transaction/new",
    label: "Input",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12" cy="12" r="9"
          stroke={active ? "var(--gold)" : "currentColor"}
          strokeWidth="1.8"
          fill={active ? "rgba(201,168,76,0.12)" : "none"}
        />
        <path d="M12 8v8M8 12h8" stroke={active ? "var(--gold)" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    primary: true,
  },
  {
    id: "nav-history",
    href: "/history",
    label: "Riwayat",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect
          x="3" y="3" width="18" height="18" rx="3"
          stroke={active ? "var(--gold)" : "currentColor"}
          strokeWidth="1.8"
          fill={active ? "rgba(201,168,76,0.12)" : "none"}
        />
        <path d="M7 8h10M7 12h6M7 16h8" stroke={active ? "var(--gold)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "nav-account",
    href: "/account",
    label: "Akun",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12" cy="8" r="4"
          stroke={active ? "var(--gold)" : "currentColor"}
          strokeWidth="1.8"
          fill={active ? "rgba(201,168,76,0.12)" : "none"}
        />
        <path
          d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
          stroke={active ? "var(--gold)" : "currentColor"}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          if (item.primary) {
            return (
              <Link
                key={item.id}
                id={item.id}
                href={item.href}
                className="flex flex-col items-center gap-1 -mt-4"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-90"
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, var(--gold-dark), var(--gold), var(--gold-light))"
                      : "linear-gradient(135deg, var(--gold-dark), var(--gold))",
                    boxShadow: "0 4px 20px var(--gold-glow)",
                  }}
                >
                  {item.icon(true)}
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: isActive ? "var(--gold)" : "var(--text-muted)" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.id}
              id={item.id}
              href={item.href}
              className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all active:scale-90"
              style={{
                color: isActive ? "var(--gold)" : "var(--text-muted)",
                background: isActive ? "rgba(201,168,76,0.06)" : "transparent",
              }}
            >
              {item.icon(isActive)}
              <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
