import { requireUser } from "@/lib/auth/session";
import { listCustomers } from "@/app/actions/customers";
import Link from "next/link";
import { CustomerList } from "@/components/customers/customer-list";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireUser(["ADMIN"]);
  const customers = await listCustomers();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Padrón</p>
        <h1 className="font-display text-4xl font-semibold">Registro</h1>
        <p className="mt-2 text-muted">
          Registro de clientes con búsqueda, sucursal de alta y exportación a Excel. Para dar de alta a un cliente nuevo usa{" "}
          <Link href="/alta" className="font-semibold text-brand hover:underline">
            Alta
          </Link>
          .
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold">Directorio ({customers.length})</h2>
        <CustomerList customers={customers} />
      </section>
    </div>
  );
}
