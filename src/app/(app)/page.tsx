import { requireUser } from "@/lib/auth/session";
import Link from "next/link";
import { Gift, ScanLine, Stamp, Users } from "lucide-react";
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
        <p className="text-xs uppercase tracking-[0.25em] text-teal">Hoy</p>
        <h1 className="font-display text-4xl text-ink">Panel de fidelidad</h1>
        <p className="mt-2 max-w-2xl text-ink/65">
          Control de asistencia de abonos. Sin caja ni cobro: solo puntualidad, racha y premios.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          icon={<Stamp className="h-5 w-5" />}
          label="Clientes en racha 4/5"
          value={String(data.streakFour.length)}
        />
        <Kpi
          icon={<Users className="h-5 w-5" />}
          label="Créditos activos"
          value={String(data.activeCredits)}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl">A un sello del premio</h2>
            <Link href="/asistencia" className="text-sm font-semibold text-teal hover:underline">
              Ir a asistencia
            </Link>
          </div>
          {data.streakFour.length === 0 ? (
            <p className="text-sm text-ink/55">Nadie está en racha 4 ahora mismo.</p>
          ) : (
            <ul className="space-y-3">
              {data.streakFour.map((credit) => (
                <li
                  key={credit.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cream px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{credit.customer.fullName}</p>
                    <p className="font-mono text-xs text-teal">{credit.customer.barcodeId}</p>
                  </div>
                  <Badge tone="gold">Racha 4/5</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-display text-2xl">Asistencias de hoy</h2>
          {data.recentAttendances.length === 0 ? (
            <p className="text-sm text-ink/55">Todavía no hay registros hoy.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentAttendances.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{payment.credit.customer.fullName}</p>
                    <p className="text-xs text-ink/55">
                      {payment.notes}
                      {payment.receivedByName ? ` · Recibió: ${payment.receivedByName}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-ink/50">
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
        rewardName={data.settings?.rewardName ?? "Premio 5to Abono"}
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
    <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-3 inline-flex rounded-full bg-cream p-2 text-teal">{icon}</div>
      <p className="text-sm text-ink/55">{label}</p>
      <p className="font-display text-4xl">{value}</p>
    </article>
  );
}
