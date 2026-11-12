"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveGiftTiers } from "@/app/actions/gifts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tier = {
  slot: number;
  name: string;
  description: string;
  marksRequired: number | null;
};

export function GiftTiersEditor({ initial }: { initial: Tier[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Tier[]>(
    [1, 2, 3].map((slot) => {
      const found = initial.find((tier) => tier.slot === slot);
      return {
        slot,
        name: found?.name ?? `Regalo ${slot}`,
        description: found?.description ?? "",
        marksRequired: found?.marksRequired ?? (slot === 1 ? 5 : slot === 2 ? 10 : 15),
      };
    }),
  );
  const [busy, setBusy] = useState(false);

  function update(slot: number, patch: Partial<Tier>) {
    setRows((prev) => prev.map((row) => (row.slot === slot ? { ...row, ...patch } : row)));
  }

  return (
    <form
      className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          const payload = rows.map((row) => ({
            slot: row.slot,
            name: row.name,
            description: row.description,
            marksRequired:
              row.marksRequired == null || String(row.marksRequired).trim() === ""
                ? null
                : Number(row.marksRequired),
          }));
          const result = await saveGiftTiers(payload);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Configuración de regalos guardada");
          router.refresh();
        } catch {
          toast.error("No se pudo guardar. Intenta de nuevo.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className="font-display text-2xl">Configuración de regalos</h2>
        <p className="mt-1 text-sm text-ink/60">
          Define el nombre/descripción del premio y cuántas marcas puntuales se necesitan. Deja el
          número vacío para desactivar ese regalo. Los números activos deben ser enteros crecientes
          (por defecto 5, 10 y 15). Tras el regalo con más marcas, la racha vuelve a 0.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-cream text-ink/60">
            <tr>
              <th className="px-3 py-2 font-medium">Regalo</th>
              <th className="px-3 py-2 font-medium">Nombre / descripción del premio</th>
              <th className="px-3 py-2 font-medium">Número de marcas necesarias</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slot} className="border-t border-line align-top">
                <td className="px-3 py-3 font-semibold">Regalo {row.slot}</td>
                <td className="px-3 py-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`gift-name-${row.slot}`} className="text-xs">
                        Nombre
                      </Label>
                      <Input
                        id={`gift-name-${row.slot}`}
                        value={row.name}
                        onChange={(event) => update(row.slot, { name: event.target.value })}
                        placeholder={`Regalo ${row.slot}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`gift-desc-${row.slot}`} className="text-xs">
                        Descripción
                      </Label>
                      <Input
                        id={`gift-desc-${row.slot}`}
                        value={row.description}
                        onChange={(event) => update(row.slot, { description: event.target.value })}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Label htmlFor={`gift-marks-${row.slot}`} className="sr-only">
                    Marcas necesarias
                  </Label>
                  <Input
                    id={`gift-marks-${row.slot}`}
                    type="number"
                    min={1}
                    step={1}
                    value={row.marksRequired ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      update(row.slot, {
                        marksRequired: value === "" ? null : Number.parseInt(value, 10),
                      });
                    }}
                    placeholder="Vacío = off"
                    className="max-w-[10rem]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Guardando…" : "Guardar regalos"}
      </Button>
    </form>
  );
}
