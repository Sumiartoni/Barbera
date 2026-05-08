"use client";

import Link from "next/link";

import { type SessionState } from "../lib/session";
import { TenantShell } from "./tenant-shell";

type TenantPageFrameProps = {
  session: SessionState | null;
  active: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function TenantPageFrame({
  session,
  active,
  title,
  description,
  actions,
  children,
}: TenantPageFrameProps) {
  if (!session) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center p-4">
        <section className="bg-white rounded-2xl shadow-xl border border-[#F0EDE8] p-8 max-w-md w-full mx-auto text-center">
          <p className="text-sm font-semibold tracking-wider text-[#C8A464] mb-2 uppercase">
            Barbera Owner
          </p>
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-4">Session belum tersedia.</h1>
          <p className="text-[#6B6B6B] mb-8">
            Login owner dulu dari halaman tenant agar halaman ini dapat memuat data tenant Anda.
          </p>
          <div className="pt-2 border-t border-[#F0EDE8]">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-3 bg-[#C8A464] hover:bg-[#B89454] text-white rounded-xl font-semibold transition-colors mt-4"
            >
              Ke Halaman Login
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <TenantShell
      session={session}
      active={active}
      title={title}
      description={description}
      actions={actions}
    >
      {children}
    </TenantShell>
  );
}
