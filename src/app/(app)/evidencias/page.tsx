import { requireUser } from "@/lib/auth/session";
import { listPendingPhotoRewards } from "@/app/actions/gifts";
import { EvidenciasBoard } from "@/components/evidencias/evidencias-board";

export const dynamic = "force-dynamic";

export default async function EvidenciasPage() {
  await requireUser();
  const items = await listPendingPhotoRewards();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Del día</p>
        <h1 className="font-display text-4xl font-semibold">Evidencias</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Premios ganados hoy que aún no tienen foto. Al subirla, la tarjeta desaparece y la imagen
          queda en la ficha del cliente.
        </p>
      </header>

      <EvidenciasBoard items={items} />
    </div>
  );
}
