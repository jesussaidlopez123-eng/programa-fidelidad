import { listCustomers } from "@/app/actions/customers";
import { CustomerForm } from "@/components/customers/customer-form";
import { CustomerList } from "@/components/customers/customer-list";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await listCustomers();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-teal">Padrón</p>
        <h1 className="font-display text-4xl">Clientes</h1>
        <p className="mt-2 text-ink/65">
          Alta de cliente con crédito inicial. Se genera un código único tipo CRD-000123 y una
          tarjeta imprimible.
        </p>
      </header>
      <CustomerForm />
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Directorio ({customers.length})</h2>
        <CustomerList customers={customers} />
      </section>
    </div>
  );
}
