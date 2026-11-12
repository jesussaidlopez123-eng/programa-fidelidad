"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StreakPips } from "@/components/streak-pips";
import { formatMoney } from "@/lib/utils";

type Credit = {
  id: string;
  concept: string;
  totalAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  currentStreak: number;
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
};

type Customer = {
  id: string;
  fullName: string;
  phone: string | null;
  barcodeId: string;
  createdByName?: string | null;
  credits: Credit[];
  rewards: { id: string }[];
};

export function CustomerList({ customers }: { customers: Customer[] }) {
  return (
    <div className="space-y-3">
      {customers.map((customer) => {
        const credit = customer.credits[0];
        return (
          <article
            key={customer.id}
            className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-sm md:grid-cols-[1fr_auto]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{customer.fullName}</h3>
                <span className="font-mono text-sm text-teal">{customer.barcodeId}</span>
                {credit ? statusBadge(credit.status) : null}
                {customer.rewards.length > 0 ? (
                  <Badge tone="gold">{customer.rewards.length} premio(s) pendiente(s)</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-ink/60">
                {customer.phone ?? "Sin teléfono"}
                {customer.createdByName ? ` · Alta: ${customer.createdByName}` : ""}
                {credit ? ` · ${credit.concept}` : ""}
                {credit
                  ? ` · ${credit.paidInstallments}/${credit.totalInstallments} abonos · ${formatMoney(credit.totalAmount)}`
                  : ""}
              </p>
              {credit ? (
                <div className="mt-3">
                  <StreakPips current={credit.currentStreak} size="sm" />
                </div>
              ) : null}
            </div>
            <div className="flex items-center">
              <Button variant="outline" asChild>
                <Link href={`/print/${customer.id}`}>
                  <Printer className="h-4 w-4" />
                  Imprimir tarjeta
                </Link>
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function statusBadge(status: Credit["status"]) {
  if (status === "ACTIVE") return <Badge tone="teal">Activo</Badge>;
  if (status === "COMPLETED") return <Badge tone="slate">Completado</Badge>;
  return <Badge tone="rose">Mora</Badge>;
}
