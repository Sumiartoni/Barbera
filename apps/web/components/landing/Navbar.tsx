"use client";
import { useEffect, useState } from "react";
import { Menu, X, Scissors } from "lucide-react";
import { Button } from "@/components/landing/ui/button";

const Navbar = () => {
  const appUrl = "";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Features", href: "#features" },
    { label: "Product", href: "#product" },
    { label: "Pricing", href: "#pricing" },
    { label: "Testimonials", href: "#testimonials" },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? "py-3" : "py-5"
      }`}
    >
      <div className="container">
        <nav
          className={`flex items-center justify-between rounded-2xl px-5 py-3 transition-all duration-500 ${
            scrolled ? "glass shadow-soft" : "bg-transparent"
          }`}
        >
          <a href="#" className="flex items-center gap-2 font-display font-extrabold text-xl">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-red shadow-glow">
              <Scissors className="w-4 h-4 text-primary-foreground" />
            </span>
            <span className="tracking-tight">Barbera</span>
          </a>

          <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="hover:text-foreground transition-colors">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden md:flex items-center gap-3">
            <a href={`${appUrl}/login`} className="text-sm font-medium hover:text-primary transition-colors">
              Login
            </a>
            <Button variant="hero" size="sm" onClick={() => window.location.href = `${appUrl}/register`}>Coba Gratis</Button>
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {open && (
          <div className="md:hidden mt-2 glass rounded-2xl p-5 animate-fade-in">
            <ul className="flex flex-col gap-4 text-sm font-medium">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
                </li>
              ))}
            </ul>
            <Button variant="hero" size="sm" className="w-full mt-4" onClick={() => window.location.href = `${appUrl}/register`}>Coba Gratis</Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
