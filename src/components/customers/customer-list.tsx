"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCustomer } from "@/app/actions/customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/utils";

type Credit = {
  id: string;
  concept: string;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  currentStreak: number;
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  _count: { payments: number };
};

type Customer = {
  id: string;
  fullName: string;
  phone: string | null;
  barcodeId: string;
  platform: "PAYJOY" | "KREDIYA" | null;
  model: string | null;
  imei: string | null;
  tagCurp: string | null;
  createdByName: string | null;
  createdAt: Date | string;
  credits: Credit[];
  rewards: { id: string; status: "PENDING" | "DELIVERED" }[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function CustomerList({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return customers;
    return customers.filter((customer) => {
      const credit = customer.credits[0];
      const haystack = normalize(
        [
          customer.fullName,
          customer.phone,
          customer.barcodeId,
          customer.platform,
          customer.model,
          customer.imei,
          customer.tagCurp,
          customer.createdByName,
          credit ? String(credit.installmentAmount) : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return haystack.includes(needle);
    });
  }, [customers, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, código, IMEI, TAG/CURP, sucursal…"
          className="pl-9"
          aria-label="Buscar clientes"
        />
      </div>

      <div className="overflow-x-auto rounded-3xl border border-line bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-line bg-cream/60 text-xs uppercase tracking-wide text-ink/55">
            <tr>
              {[
                "Código",
                "Nombre",
                "Número",
                "Plataforma",
                "Modelo",
                "IMEI",
                "TAG/CURP",
                "Abono",
                "Abonos / racha",
                "Sucursal",
                "",
              ].map((heading) => (
                <th key={heading || "acciones"} className="px-3 py-3 font-semibold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-ink/55">
                  {customers.length === 0
                    ? "Todavía no hay clientes."
                    : "Ningún cliente coincide con la búsqueda."}
                </td>
              </tr>
            ) : null}
            {filtered.map((customer) => {
              const credit = customer.credits[0];
              const pending = customer.rewards.filter((reward) => reward.status === "PENDING").length;
              return (
                <tr key={customer.id} className="align-top">
                  <td className="px-3 py-3 font-mono text-xs text-teal">{customer.barcodeId}</td>
                  <td className="px-3 py-3 font-semibold">
                    {customer.fullName}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {credit ? statusBadge(credit.status) : null}
                      {pending > 0 ? <Badge tone="gold">{pending} regalo(s)</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">{customer.phone ?? "—"}</td>
                  <td className="px-3 py-3">{customer.platform ?? "—"}</td>
                  <td className="px-3 py-3">{customer.model ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{customer.imei ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{customer.tagCurp ?? "—"}</td>
                  <td className="px-3 py-3">{credit ? formatMoney(credit.installmentAmount) : "—"}</td>
                  <td className="px-3 py-3">
                    {credit
                      ? `${credit.paidInstallments}${credit.totalInstallments > 0 ? `/${credit.totalInstallments}` : ""} · racha ${credit.currentStreak}/5`
                      : "—"}
                  </td>
                  <td className="px-3 py-3">{customer.createdByName ?? "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/print/${customer.id}`}>
                          <Printer className="h-3.5 w-3.5" />
                          Tarjeta
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-700"
                        onClick={() => setTarget(customer)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink/50">
        Mostrando {filtered.length} de {customers.length} cliente(s).
      </p>

      <DeleteDialog customer={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function DeleteDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const credits = customer?.credits.length ?? 0;
  const payments = customer?.credits.reduce((sum, credit) => sum + credit._count.payments, 0) ?? 0;
  const rewards = customer?.rewards.length ?? 0;

  function close() {
    setPassword("");
    setError(null);
    onClose();
  }

  return (
    <Dialog open={!!customer} onOpenChange={(open) => (!open ? close() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar cliente</DialogTitle>
          <DialogDescription>
            Vas a eliminar a <strong>{customer?.fullName}</strong> ({customer?.barcodeId}).
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!customer) return;
            setBusy(true);
            setError(null);
            try {
              const result = await deleteCustomer(customer.id, password);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              toast.success("Cliente eliminado");
              close();
              router.refresh();
            } catch {
              setError("No se pudo eliminar. Intenta de nuevo.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Esta acción no se puede deshacer.</p>
            <p className="mt-1">
              También se eliminarán de forma permanente sus datos relacionados: {credits} crédito(s),{" "}
              {payments} abono(s) registrado(s) y {rewards} regalo(s).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delete-password">Tu contraseña de administrador</Label>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoFocus
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={busy || !password}>
              {busy ? "Eliminando…" : "Eliminar definitivamente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function statusBadge(status: Credit["status"]) {
  if (status === "ACTIVE") return <Badge tone="teal">Activo</Badge>;
  if (status === "COMPLETED") return <Badge tone="slate">Completado</Badge>;
  return <Badge tone="rose">Mora</Badge>;
}
