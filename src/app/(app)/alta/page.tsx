import { CustomerForm } from "@/components/customers/customer-form";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AltaPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-teal">Sucursal</p>
        <h1 className="font-display text-4xl">Alta de clientes</h1>
        <p className="mt-2 text-ink/65">
          Alta de cliente con crédito inicial. Se genera un código único tipo CRD-000123 y una
          tarjeta imprimible.
        </p>
      </header>
      <CustomerForm />
    </div>
  );
}
