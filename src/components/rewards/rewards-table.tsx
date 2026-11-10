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
  customer: { fullName: string; barcodeId: string };
  credit: { concept: string };
};

export function RewardsTable({ rewards }: { rewards: RewardRow[] }) {
  const router = useRouter();

  if (rewards.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line bg-white/60 px-5 py-10 text-center text-sm text-ink/55">
        No hay premios en este filtro.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-cream text-ink/60">
            <tr>
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
                  <p className="font-medium">{reward.customer.fullName}</p>
                  <p className="font-mono text-xs text-teal">{reward.customer.barcodeId}</p>
                </td>
                <td className="px-4 py-3">{reward.rewardName}</td>
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
                    <span className="text-xs text-ink/45">
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
