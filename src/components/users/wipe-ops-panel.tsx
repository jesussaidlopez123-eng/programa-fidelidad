"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { wipeOperationalDataAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WIPE_CONFIRMATION_PHRASE } from "@/lib/wipe-operational-data";

export function WipeOpsPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const phraseOk = phrase.trim() === WIPE_CONFIRMATION_PHRASE;

  function reset() {
    setPhrase("");
    setBusy(false);
    setDone(false);
  }

  async function handleWipe() {
    if (!phraseOk || busy) return;

    const secondOk = window.confirm(
      "¿Seguro que quieres empezar desde cero?\n\nSe borrarán clientes, abonos, evidencias y lotes de impresión. Los usuarios y la configuración de regalos se conservan.\n\nEsta acción no se puede deshacer.",
    );
    if (!secondOk) return;

    setBusy(true);
    try {
      const result = await wipeOperationalDataAction(phrase);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDone(true);
      toast.success("Datos de ejemplo eliminados. Ya puedes empezar desde cero.");
      router.refresh();
    } catch {
      toast.error("No se pudieron limpiar los datos. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-danger/25 bg-danger-soft/40 p-5 shadow-sm">
      <h2 className="font-display text-2xl font-semibold text-ink">Administración</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Antes del go-live oficial puedes borrar los datos de ejemplo (clientes, abonos,
        evidencias y lotes). Se conservan los usuarios, contraseñas y la configuración de
        regalos y ciclo.
      </p>

      {done ? (
        <p className="mt-4 rounded-xl border border-success/25 bg-success-soft px-4 py-3 text-sm font-medium text-success">
          Listo. Datos de ejemplo eliminados. Ya puedes empezar desde cero.
        </p>
      ) : (
        <div className="mt-4">
          <Button type="button" variant="danger" onClick={() => setOpen(true)}>
            Limpiar datos de ejemplo
          </Button>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && !done) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empezar desde cero</DialogTitle>
            <DialogDescription>
              Se borrarán clientes, créditos, abonos, evidencias y lotes de impresión. También
              se reinicia la secuencia de tarjetas. Los usuarios y la configuración se
              conservan.
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="space-y-4">
              <p className="rounded-xl border border-success/25 bg-success-soft px-4 py-3 text-sm font-medium text-success">
                Listo. Datos de ejemplo eliminados. Ya puedes empezar desde cero.
              </p>
              <Button type="button" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleWipe();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="wipe-confirm">
                  Escribe <span className="font-semibold text-ink">{WIPE_CONFIRMATION_PHRASE}</span>{" "}
                  para confirmar
                </Label>
                <Input
                  id="wipe-confirm"
                  value={phrase}
                  onChange={(event) => setPhrase(event.target.value)}
                  autoComplete="off"
                  autoFocus
                  placeholder={WIPE_CONFIRMATION_PHRASE}
                  disabled={busy}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="danger" disabled={!phraseOk || busy}>
                  {busy ? "Limpiando…" : "Empezar desde cero"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
