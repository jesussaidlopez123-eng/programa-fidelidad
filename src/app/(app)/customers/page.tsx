import { requireUser } from "@/lib/auth/session";
import { listCustomers } from "@/app/actions/customers";
import Link from "next/link";
import { CustomerList } from "@/components/customers/customer-list";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireUser(["ADMIN"]);
  const customers = await listCustomers();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-teal">Padrón</p>
        <h1 className="font-display text-4xl">Clientes</h1>
        <p className="mt-2 text-ink/65">
          Directorio de clientes con su racha y premios. Para dar de alta a un cliente nuevo usa{" "}
          <Link href="/alta" className="font-semibold text-teal hover:underline">
            Alta
          </Link>
          .
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Directorio ({customers.length})</h2>
        <CustomerList customers={customers} />
      </section>
    </div>
  );
}
