import { requireUser } from "@/lib/auth/session";
import Link from "next/link";
import { RewardStatus } from "@prisma/client";
import { listRewardsSummary } from "@/app/actions/rewards";
import { listGiftTiers } from "@/app/actions/gifts";
import { RewardsTable } from "@/components/rewards/rewards-table";
import { GiftTiersEditor } from "@/components/rewards/gift-tiers-editor";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RewardsPage({
  searchParams,
}: {
  searchParams?: { estado?: string };
}) {
  await requireUser(["ADMIN"]);
  const estado = searchParams?.estado;
  const status =
    estado === "PENDING" || estado === "DELIVERED" ? (estado as RewardStatus) : undefined;
  const [rewards, tiers] = await Promise.all([listRewardsSummary(status), listGiftTiers()]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-teal">Programa</p>
        <h1 className="font-display text-4xl">Regalos</h1>
        <p className="mt-2 text-ink/65">
          Configura hasta tres regalos por número de marcas puntuales y entrega los premios ganados.
        </p>
      </header>

      <GiftTiersEditor
        initial={tiers.map((tier) => ({
          slot: tier.slot,
          name: tier.name,
          description: tier.description,
          marksRequired: tier.marksRequired,
        }))}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Premios ganados</h2>
            <p className="text-sm text-ink/60">Miniatura de la foto y estado de entrega.</p>
          </div>
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
        </div>
        <RewardsTable rewards={rewards} />
      </section>
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
