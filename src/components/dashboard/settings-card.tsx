import { updateSettings } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export function SettingsCard({
  dueDayOfMonth,
  graceDays,
}: {
  dueDayOfMonth: number;
  graceDays: number;
}) {
  return (
    <form
      action={updateSettings}
      className="rounded-3xl border border-line bg-white p-5 shadow-sm"
    >
      <h2 className="font-display text-2xl">Reglas de puntualidad</h2>
      <p className="mb-4 mt-1 text-sm text-ink/60">
        Un abono es puntual si se registra el día de corte o durante los días de gracia. Los regalos
        por número de marcas se configuran en{" "}
        <Link href="/rewards" className="font-semibold text-teal hover:underline">
          Regalos
        </Link>
        .
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dueDayOfMonth">Día de corte</Label>
          <Input
            id="dueDayOfMonth"
            name="dueDayOfMonth"
            type="number"
            min={1}
            max={31}
            defaultValue={dueDayOfMonth}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="graceDays">Días de gracia</Label>
          <Input
            id="graceDays"
            name="graceDays"
            type="number"
            min={0}
            max={30}
            defaultValue={graceDays}
          />
        </div>
      </div>
      <div className="mt-4">
        <Button type="submit" variant="outline">
          Guardar reglas
        </Button>
      </div>
    </form>
  );
}
