import { requireUser } from "@/lib/auth/session";
import { getCardPrintState } from "@/app/actions/card-print";
import { CardPrintStudio } from "@/components/impresion/card-print-studio";

export const dynamic = "force-dynamic";

export default async function ImpresionTarjetasPage() {
  await requireUser(["ADMIN"]);
  const state = await getCardPrintState();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">CREDICEL</p>
        <h1 className="font-display text-4xl font-semibold">Impresión de tarjetas</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Genera lotes de códigos de barras (Code 128) sobre siluetas tamaño tarjeta de crédito
          en PDF A4 para papel calcomanía.
        </p>
      </header>
      <CardPrintStudio initial={state} />
    </div>
  );
}
