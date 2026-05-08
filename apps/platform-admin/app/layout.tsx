import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap"
});

export const metadata: Metadata = {
  title: "BARBERA Internal Admin",
  description: "Panel internal BARBERA untuk mengelola tenant, pricing, usage, dan monitoring platform.",
  icons: {
    icon: "/barbera-icon.svg",
    shortcut: "/barbera-icon.svg",
    apple: "/barbera-icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${bodyFont.variable} ${headingFont.variable}`}
    >
      <body
        style={{
          margin: 0,
          fontFamily: "var(--font-body), sans-serif",
          background:
            "radial-gradient(circle at top left, rgba(213, 171, 58, 0.16), transparent 18%), linear-gradient(180deg, #f5f0e6 0%, #efe7db 100%)",
          color: "#1d1710"
        }}
      >
        {children}
      </body>
    </html>
  );
}
