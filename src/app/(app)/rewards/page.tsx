import Link from "next/link";
import { RewardStatus } from "@prisma/client";
import { listRewards } from "@/app/actions/rewards";
import { RewardsTable } from "@/components/rewards/rewards-table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RewardsPage({
  searchParams,
}: {
  searchParams?: { estado?: string };
}) {
  const estado = searchParams?.estado;
  const status =
    estado === "PENDING" || estado === "DELIVERED" ? (estado as RewardStatus) : undefined;
  const rewards = await listRewards(status);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-teal">Programa</p>
        <h1 className="font-display text-4xl">Premios</h1>
        <p className="mt-2 text-ink/65">
          Cada cinco abonos puntuales se desbloquea un premio. Entrégalo ahora o déjalo pendiente.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Filter href="/rewards" active={!status}>
          Todos
        </Filter>
        <Filter href="/rewards?estado=PENDING" active={status === "PENDING"}>
          Pendientes
        </Filter>
        <Filter href="/rewards?estado=DELIVERED" active={status === "DELIVERED"}>
          Entregados
        </Filter>
      </div>

      <RewardsTable rewards={rewards} />
    </div>
  );
}

function Filter({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold",
        active ? "bg-forest text-cream" : "bg-white text-ink/70 ring-1 ring-line",
      )}
    >
      {children}
    </Link>
  );
}
