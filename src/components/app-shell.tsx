"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gift,
  Images,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import { ROLE_LABEL, type Role } from "@/lib/auth/config";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: typeof Users; roles: Role[] }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN"] },
  { href: "/asistencia", label: "Recepción de abono", icon: ScanLine, roles: ["SUCURSAL", "ADMIN"] },
  { href: "/evidencias", label: "Evidencias", icon: Images, roles: ["SUCURSAL", "ADMIN"] },
  { href: "/customers", label: "Registro", icon: Users, roles: ["ADMIN"] },
  { href: "/rewards", label: "Regalos", icon: Gift, roles: ["ADMIN"] },
  { href: "/usuarios", label: "Usuarios", icon: KeyRound, roles: ["ADMIN"] },
  { href: "/alta", label: "Alta", icon: UserPlus, roles: ["SUCURSAL", "ADMIN"] },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; role: Role };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page lg:grid lg:grid-cols-[260px_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-line bg-white p-5 transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="block" onClick={() => setOpen(false)}>
            <p className="font-display text-2xl font-semibold tracking-tight text-brand">Fidelidad</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted">
              Control de abonos
            </p>
          </Link>
          <button
            className="rounded-lg p-2 text-muted hover:bg-page hover:text-ink lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-1">
          {NAV.filter((item) => item.roles.includes(user.role)).map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "text-ink/75 hover:bg-page hover:text-brand",
                )}
              >
                <Icon className="h-4 w-4 stroke-[1.75]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 rounded-xl border border-line bg-page p-3">
          <div>
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
              {ROLE_LABEL[user.role]}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink/80 transition hover:bg-page hover:text-brand"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {open ? (
        <button
          className="fixed inset-0 z-30 bg-midnight/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        />
      ) : null}

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            className="rounded-xl border border-line bg-white p-2 text-ink"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-lg font-semibold text-brand">Fidelidad</span>
          <span className="w-9" />
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
