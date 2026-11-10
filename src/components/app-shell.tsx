"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, LayoutDashboard, Menu, ScanLine, Users, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/asistencia", label: "Asistencia", icon: ScanLine },
  { href: "/customers", label: "Clientes", icon: Users },
  { href: "/rewards", label: "Premios", icon: Gift },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[260px] border-r border-white/10 bg-forest p-5 text-cream transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="block" onClick={() => setOpen(false)}>
            <p className="font-display text-2xl tracking-wide text-gold">Fidelidad</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-cream/60">
              Control de abonos
            </p>
          </Link>
          <button className="rounded-full p-2 lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-1.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-gold text-ink shadow-sm"
                    : "text-cream/80 hover:bg-white/10 hover:text-cream",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-10 px-3 text-xs leading-relaxed text-cream/45">
          Escanea el código, registra la asistencia del abono y acumula sellos de puntualidad.
        </p>
      </aside>

      {open ? (
        <button
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        />
      ) : null}

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-cream/85 px-4 py-3 backdrop-blur lg:hidden">
          <button
            className="rounded-full border border-line bg-white p-2"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-lg text-forest">Fidelidad</span>
          <span className="w-9" />
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
