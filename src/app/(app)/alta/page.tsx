import { CustomerForm } from "@/components/customers/customer-form";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AltaPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Sucursal</p>
        <h1 className="font-display text-4xl font-semibold">Alta de clientes</h1>
        <p className="mt-2 text-muted">
          Escanea la tarjeta nueva y captura los datos del cliente. El código escaneado queda como
          su código de barras para registrar abonos.
        </p>
      </header>
      <CustomerForm />
    </div>
  );
}
