import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  await requireUser(["ADMIN"]);

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      credits: {
        orderBy: { createdAt: "desc" },
        include: {
          payments: { orderBy: { paymentDate: "desc" }, take: 12 },
        },
      },
      rewards: {
        orderBy: { unlockedAt: "desc" },
        select: {
          id: true,
          rewardName: true,
          status: true,
          unlockedAt: true,
          deliveredAt: true,
          giftSlot: true,
          marksRequired: true,
          photoMimeType: true,
          photoUploadedAt: true,
          unlockedByName: true,
        },
      },
    },
  });

  if (!customer) notFound();

  const credit = customer.credits[0];
  const photos = customer.rewards.filter((reward) => reward.photoUploadedAt != null);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <Link href="/customers" className="text-sm font-semibold text-brand hover:underline">
          ← Volver a clientes
        </Link>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Ficha</p>
        <h1 className="font-display text-4xl font-semibold">{customer.fullName}</h1>
        <p className="font-mono text-sm text-brand">{customer.barcodeId}</p>
      </header>

      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="font-display text-2xl font-semibold">Datos</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Info label="Número" value={customer.phone} />
          <Info label="Correo" value={customer.email} />
          <Info label="Plataforma" value={customer.platform} />
          <Info label="Modelo" value={customer.model} />
          <Info label="IMEI" value={customer.imei} mono />
          <Info label="TAG/CURP" value={customer.tagCurp} mono />
          <Info
            label="Monto de abono"
            value={credit ? formatMoney(credit.installmentAmount) : null}
          />
          <Info label="Alta por" value={customer.createdByName} />
          <Info
            label="Racha actual"
            value={
              credit
                ? String(credit.currentStreak)
                : null
            }
          />
          <Info
            label="Abonos registrados"
            value={
              credit
                ? credit.totalInstallments > 0
                  ? `${credit.paidInstallments}/${credit.totalInstallments}`
                  : String(credit.paidInstallments)
                : null
            }
          />
        </dl>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Fotos de premios</h2>
          <p className="text-sm text-muted">Evidencias subidas al ganar un regalo.</p>
        </div>
        {photos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white px-5 py-8 text-center text-sm text-muted">
            Todavía no hay fotos de premios para este cliente.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((reward) => (
              <figure key={reward.id} className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/rewards/${reward.id}/photo`}
                  alt={reward.rewardName}
                  className="aspect-square w-full object-cover"
                />
                <figcaption className="space-y-1 p-3 text-sm">
                  <p className="font-semibold">{reward.rewardName}</p>
                  <p className="text-xs text-muted">{formatDate(reward.unlockedAt)}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Historial de regalos</h2>
          <p className="text-sm text-muted">Todos los premios desbloqueados, con fecha.</p>
        </div>
        {customer.rewards.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white px-5 py-8 text-center text-sm text-muted">
            Este cliente aún no ha ganado regalos.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-midnight text-white/85">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Regalo</th>
                  <th className="px-4 py-3 font-medium">Foto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {customer.rewards.map((reward) => (
                  <tr key={reward.id} className="border-t border-line">
                    <td className="px-4 py-3">{formatDate(reward.unlockedAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{reward.rewardName}</p>
                      {reward.marksRequired ? (
                        <p className="text-xs text-muted">{reward.marksRequired} marcas</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {reward.photoUploadedAt ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/rewards/${reward.id}/photo`}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted">Pendiente</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {reward.status === "PENDING" ? (
                        <Badge tone="gold">Pendiente</Badge>
                      ) : (
                        <Badge tone="teal">Entregado</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className={mono ? "break-all font-mono text-xs" : "font-medium"}>{value || "—"}</dd>
    </div>
  );
}
