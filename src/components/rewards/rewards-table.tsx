"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deliverReward } from "@/app/actions/rewards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type RewardRow = {
  id: string;
  rewardName: string;
  status: "PENDING" | "DELIVERED";
  unlockedAt: Date;
  deliveredAt: Date | null;
  hasPhoto: boolean;
  giftSlot: number | null;
  marksRequired: number | null;
  customer: { fullName: string; barcodeId: string };
  credit: { concept: string };
};

export function RewardsTable({ rewards }: { rewards: RewardRow[] }) {
  const router = useRouter();

  if (rewards.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-white px-5 py-10 text-center text-sm text-muted">
        No hay premios en este filtro.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-midnight text-white/85">
            <tr>
              <th className="px-4 py-3 font-medium">Foto</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Premio</th>
              <th className="px-4 py-3 font-medium">Crédito</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Desbloqueado</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rewards.map((reward) => (
              <tr key={reward.id} className="border-t border-line">
                <td className="px-4 py-3">
                  {reward.hasPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/rewards/${reward.id}/photo`}
                      alt={`Foto de ${reward.customer.fullName}`}
                      className="h-14 w-14 rounded-xl object-cover ring-1 ring-line"
                    />
                  ) : (
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-page text-[10px] uppercase tracking-wide text-muted ring-1 ring-line">
                      Sin foto
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{reward.customer.fullName}</p>
                  <p className="font-mono text-xs text-brand">{reward.customer.barcodeId}</p>
                </td>
                <td className="px-4 py-3">
                  <p>{reward.rewardName}</p>
                  {reward.marksRequired ? (
                    <p className="text-xs text-muted">{reward.marksRequired} marcas</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink/70">{reward.credit.concept}</td>
                <td className="px-4 py-3">
                  {reward.status === "PENDING" ? (
                    <Badge tone="gold">Pendiente</Badge>
                  ) : (
                    <Badge tone="teal">Entregado</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-ink/70">{formatDate(reward.unlockedAt)}</td>
                <td className="px-4 py-3 text-right">
                  {reward.status === "PENDING" ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await deliverReward(reward.id);
                        toast.success("Premio entregado");
                        router.refresh();
                      }}
                    >
                      Marcar entregado
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">
                      {reward.deliveredAt ? formatDate(reward.deliveredAt) : ""}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
