"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer, Search, Trash2 } from "lucide-react";
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
import { downloadRegistroExcel, type RegistroExportRow } from "@/lib/export-registro";
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
  payments: { paymentDate: Date | string }[];
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
  rewards: { id: string; rewardName: string; status: "PENDING" | "DELIVERED" }[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toExportRow(customer: Customer): RegistroExportRow {
  const credit = customer.credits[0];
  const won = customer.rewards.length;
  const pending = customer.rewards.filter((reward) => reward.status === "PENDING").length;
  return {
    barcodeId: customer.barcodeId,
    fullName: customer.fullName,
    phone: customer.phone,
    platform: customer.platform,
    model: customer.model,
    imei: customer.imei,
    tagCurp: customer.tagCurp,
    installmentAmount: credit?.installmentAmount ?? null,
    racha: credit?.currentStreak ?? null,
    abonosTotales: credit?._count.payments ?? null,
    createdByName: customer.createdByName,
    createdAt: customer.createdAt,
    lastPaymentAt: credit?.payments[0]?.paymentDate ?? null,
    creditStatus: credit?.status ?? null,
    rewardsWon: won,
    rewardsPending: pending,
    rewardNames: customer.rewards.map((reward) => reward.rewardName).join("; "),
  };
}

export function CustomerList({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Customer | null>(null);
  const [exporting, setExporting] = useState(false);

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

  const hasFilter = normalize(query.trim()).length > 0;

  async function handleExport() {
    setExporting(true);
    try {
      await downloadRegistroExcel(filtered.map(toExportRow));
      toast.success(
        hasFilter
          ? `Excel descargado (${filtered.length} filtrado(s))`
          : `Excel descargado (${filtered.length} registro(s))`,
      );
    } catch {
      toast.error("No se pudo generar el Excel. Intenta de nuevo.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, código, IMEI, TAG/CURP, sucursal…"
            className="pl-9"
            aria-label="Buscar en el registro"
          />
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={exporting || filtered.length === 0}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Generando…" : "Exportar Excel"}
          </Button>
          <p className="max-w-xs text-xs text-muted">
            Descarga lo visible: con búsqueda, solo filtrados; sin búsqueda, todo el registro.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-midnight text-xs uppercase tracking-wide text-white/85">
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
                "Racha",
                "Abonos totales",
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
                <td colSpan={12} className="px-3 py-10 text-center text-muted">
                  {customers.length === 0
                    ? "Todavía no hay registros."
                    : "Ningún registro coincide con la búsqueda."}
                </td>
              </tr>
            ) : null}
            {filtered.map((customer) => {
              const credit = customer.credits[0];
              const pending = customer.rewards.filter((reward) => reward.status === "PENDING").length;
              return (
                <tr key={customer.id} className="align-top">
                  <td className="px-3 py-3 font-mono text-xs text-brand">{customer.barcodeId}</td>
                  <td className="px-3 py-3 font-semibold">
                    <Link href={`/customers/${customer.id}`} className="hover:text-brand hover:underline">
                      {customer.fullName}
                    </Link>
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
                  <td className="px-3 py-3">{credit ? credit.currentStreak : "—"}</td>
                  <td className="px-3 py-3">{credit ? credit._count.payments : "—"}</td>
                  <td className="px-3 py-3">{customer.createdByName ?? "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/customers/${customer.id}`}>Ficha</Link>
                      </Button>
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
      <p className="text-xs text-muted">
        Mostrando {filtered.length} de {customers.length} registro(s).
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
          <div className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
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
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
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
