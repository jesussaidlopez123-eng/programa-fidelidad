import { requireUser } from "@/lib/auth/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/app/actions/customers";
import { LoyaltyCard } from "@/components/customers/loyalty-card";
import { PrintButton } from "@/app/print/[customerId]/print-button";

export const dynamic = "force-dynamic";

export default async function PrintCardPage({
  params,
}: {
  params: { customerId: string };
}) {
  const user = await requireUser();
  const customer = await getCustomer(params.customerId);
  if (!customer) notFound();
  const credit = customer.credits.find((item) => item.status === "ACTIVE") ?? customer.credits[0];

  return (
    <div className="print-sheet mx-auto min-h-screen max-w-xl px-4 py-10">
      <div className="print-hidden mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Tarjeta digital</p>
          <h1 className="font-display text-3xl font-semibold">Imprimir tarjeta</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={user.role === "ADMIN" ? "/customers" : "/alta"}
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
          >
            Volver
          </Link>
          <PrintButton />
        </div>
      </div>
      <LoyaltyCard
        fullName={customer.fullName}
        barcodeId={customer.barcodeId}
        currentStreak={credit?.currentStreak ?? 0}
      />
    </div>
  );
}
