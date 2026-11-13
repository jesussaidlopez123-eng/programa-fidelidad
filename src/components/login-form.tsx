"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { login, type LoginUserOption } from "@/app/actions/auth";
import { ROLE_LABEL } from "@/lib/auth/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function LoginForm({ users }: { users: LoginUserOption[] }) {
  const router = useRouter();
  const listId = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function chooseUser(name: string) {
    setSelected(name);
    setOpen(false);
    setError(null);
    requestAnimationFrame(() => passwordRef.current?.focus());
  }

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        setPending(true);
        setError(null);
        try {
          const result = await login(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.replace(result.home);
          router.refresh();
        } catch {
          setError("No se pudo iniciar sesión. Intenta de nuevo en unos segundos.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-1.5" ref={rootRef}>
        <Label id={`${listId}-label`}>Usuario</Label>
        <input type="hidden" name="name" value={selected} required />
        <button
          type="button"
          id="name"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={`${listId}-label`}
          disabled={users.length === 0}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-left text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
            selected ? "text-ink" : "text-muted",
            open && "ring-2 ring-brand/35",
          )}
        >
          <span className="truncate">{selected || "Elige un usuario"}</span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={`${listId}-label`}
            className="max-h-64 overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-md"
          >
            {users.map((user) => {
              const active = user.name === selected;
              return (
                <li key={user.name} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3.5 py-2.5 text-left transition hover:bg-page",
                      active && "bg-brand/5",
                    )}
                    onClick={() => chooseUser(user.name)}
                  >
                    <span className="text-sm font-medium text-ink">{user.name}</span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
                      {ROLE_LABEL[user.role]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {users.length === 0 ? (
          <p className="text-sm text-muted">No hay usuarios registrados todavía.</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          ref={passwordRef}
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending || !selected}>
        {pending ? "Entrando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
