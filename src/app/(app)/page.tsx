import { requireUser } from "@/lib/auth/session";
import Link from "next/link";
import { Gift, Images, ScanLine, Stamp, Users } from "lucide-react";
import { getDashboardData } from "@/app/actions/dashboard";
import { SettingsCard } from "@/components/dashboard/settings-card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser(["ADMIN"]);
  const data = await getDashboardData();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Hoy</p>
        <h1 className="font-display text-4xl font-semibold text-ink">Panel de fidelidad</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Control de asistencia de abonos. Sin caja ni cobro: solo puntualidad, racha y premios.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          icon={<ScanLine className="h-5 w-5" />}
          label="Asistencias de abono hoy"
          value={String(data.attendancesToday)}
        />
        <Kpi
          icon={<Gift className="h-5 w-5" />}
          label="Premios pendientes"
          value={String(data.pendingRewards)}
        />
        <Kpi
          icon={<Images className="h-5 w-5" />}
          label="Fotos pendientes hoy"
          value={String(data.pendingPhotos)}
        />
        <Kpi
          icon={<Stamp className="h-5 w-5" />}
          label={`Clientes en racha ${data.almostThere}/${data.firstThreshold}`}
          value={String(data.streakNear.length)}
        />
        <Kpi
          icon={<Users className="h-5 w-5" />}
          label="Créditos activos"
          value={String(data.activeCredits)}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">A un sello del premio</h2>
            <Link href="/asistencia" className="text-sm font-semibold text-brand hover:underline">
              Ir a asistencia
            </Link>
          </div>
          {data.streakNear.length === 0 ? (
            <p className="text-sm text-muted">
              Nadie está en racha {data.almostThere} ahora mismo.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.streakNear.map((credit) => (
                <li
                  key={credit.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-page px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{credit.customer.fullName}</p>
                    <p className="font-mono text-xs text-brand">{credit.customer.barcodeId}</p>
                  </div>
                  <Badge tone="gold">
                    Racha {credit.currentStreak}/{credit.target}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Asistencias de hoy</h2>
            <Link href="/evidencias" className="text-sm font-semibold text-brand hover:underline">
              Evidencias
            </Link>
          </div>
          {data.recentAttendances.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay registros hoy.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentAttendances.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{payment.credit.customer.fullName}</p>
                    <p className="text-xs text-muted">
                      {payment.notes}
                      {payment.receivedByName ? ` · Recibió: ${payment.receivedByName}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>{formatDate(payment.paymentDate)}</p>
                    {payment.isOnTime ? (
                      <Badge tone="teal">Puntual</Badge>
                    ) : (
                      <Badge tone="rose">Tardío</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <SettingsCard
        dueDayOfMonth={data.settings?.dueDayOfMonth ?? 15}
        graceDays={data.settings?.graceDays ?? 3}
      />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-3 inline-flex rounded-xl bg-brand/10 p-2 text-brand">{icon}</div>
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-4xl font-semibold">{value}</p>
    </article>
  );
}
