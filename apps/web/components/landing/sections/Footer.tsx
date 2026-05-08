"use client";
import { Scissors, Instagram, Twitter, Youtube } from "lucide-react";

const Footer = () => (
  <footer className="bg-secondary text-secondary-foreground pt-20 pb-10">
    <div className="container">
      <div className="grid md:grid-cols-5 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-display font-extrabold text-xl mb-4">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-red shadow-glow">
              <Scissors className="w-4 h-4" />
            </span>
            Barbera
          </div>
          <p className="text-sm text-white/60 max-w-xs">
            POS dan dashboard bisnis khusus barbershop modern.
          </p>
          <div className="flex gap-3 mt-6">
            {[Instagram, Twitter, Youtube].map((Icon, i) => (
              <a key={i} href="#" aria-label="social" className="w-9 h-9 rounded-lg glass-dark grid place-items-center hover:bg-primary transition-colors">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        {[
          { title: "Product", links: ["Features", "Pricing", "Demo", "Changelog"] },
          { title: "Support", links: ["Help Center", "Contact", "Status", "API Docs"] },
          { title: "Legal", links: ["Terms", "Privacy", "Security", "Cookies"] },
        ].map((col) => (
          <div key={col.title}>
            <div className="text-sm font-bold mb-4">{col.title}</div>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm text-white/60 hover:text-white transition-colors">{l}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between gap-4 text-xs text-white/40">
        <div>Â© {new Date().getFullYear()} Barbera. All rights reserved.</div>
        <div>Dibuat dengan â¤ï¸ untuk barbershop Indonesia.</div>
      </div>
    </div>
  </footer>
);

export default Footer;
