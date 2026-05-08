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
  title: {
    default: "Barbera",
    template: "%s | Barbera"
  },
  description:
    "Barbera membantu barbershop meningkatkan repeat customer lewat reminder WhatsApp, loyalty, dan data kunjungan yang rapi.",
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
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
