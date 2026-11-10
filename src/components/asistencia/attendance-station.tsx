"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScanLine, Sparkles } from "lucide-react";
import {
  lookupByBarcode,
  markRewardDelivered,
  registerAttendance,
  type AttendanceLookup,
  type LateDecision,
} from "@/app/actions/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StreakPips } from "@/components/streak-pips";
import { WebcamScanner } from "@/components/asistencia/webcam-scanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AttendanceStation() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lookup, setLookup] = useState<AttendanceLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lateOpen, setLateOpen] = useState(false);
  const [prize, setPrize] = useState<{ id: string; name: string } | null>(null);

  const focusScan = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    focusScan();
  }, [focusScan]);

  const runLookup = useCallback(
    async (value: string) => {
      const barcode = value.trim();
      if (!barcode) return;
      setLoading(true);
      setError(null);
      const result = await lookupByBarcode(barcode);
      setLoading(false);
      if (!result.ok) {
        setLookup(null);
        setError(result.error);
        toast.error(result.error);
        focusScan();
        return;
      }
      setLookup(result.data);
      setQuery(result.data.customer.barcodeId);
    },
    [focusScan],
  );

  async function onScanSubmit(event: FormEvent) {
    event.preventDefault();
    await runLookup(query);
  }

  async function submitAttendance(lateDecision?: LateDecision) {
    if (!lookup?.credit) return;
    setSubmitting(true);
    const result = await registerAttendance({
      creditId: lookup.credit.id,
      lateDecision,
    });
    setSubmitting(false);

    if (!result.ok && result.needsLateDecision) {
      setLateOpen(true);
      return;
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setLateOpen(false);
    toast.success(result.data.notes);
    if (result.data.rewardUnlocked && result.data.rewardId) {
      setPrize({ id: result.data.rewardId, name: result.data.rewardName ?? "Premio" });
    }
    await runLookup(lookup.customer.barcodeId);
    focusScan();
  }

  const credit = lookup?.credit;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <form onSubmit={onScanSubmit} className="rounded-3xl border border-line bg-white/80 p-5 shadow-sm">
        <label htmlFor="scan" className="mb-2 block text-sm font-medium text-ink/70">
          Lector USB o código manual
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-teal" />
            <Input
              id="scan"
              ref={inputRef}
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Escanea y presiona Enter…"
              className="h-14 pl-11 font-mono text-lg tracking-wide"
            />
          </div>
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Buscando…" : "Buscar"}
          </Button>
        </div>
        <div className="mt-4">
          <WebcamScanner onScan={(value) => void runLookup(value)} />
        </div>
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </form>

      {lookup ? (
        <section className="rounded-3xl border border-line bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Cliente</p>
              <h2 className="font-display text-3xl text-ink">{lookup.customer.fullName}</h2>
              <p className="mt-1 font-mono text-sm text-teal">{lookup.customer.barcodeId}</p>
              {lookup.customer.phone ? (
                <p className="text-sm text-ink/60">{lookup.customer.phone}</p>
              ) : null}
            </div>
            {lookup.punctuality.isOnTime ? (
              <Badge tone="teal">Se registrará como puntual</Badge>
            ) : (
              <Badge tone="rose">Se registrará como tardío</Badge>
            )}
          </div>

          {credit ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl bg-cream px-4 py-3">
                <p className="text-sm text-ink/60">{credit.concept}</p>
                <p className="mt-1 text-lg font-semibold">
                  Abono {Math.min(credit.paidInstallments + 1, credit.totalInstallments)} de{" "}
                  {credit.totalInstallments}
                </p>
                <p className="text-sm text-ink/55">
                  Asistencias registradas: {credit.paidInstallments}/{credit.totalInstallments} ·{" "}
                  {lookup.punctuality.label}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink/70">Sellos de puntualidad</p>
                <StreakPips current={credit.currentStreak} size="lg" />
              </div>

              {credit.status === "ACTIVE" ? (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={submitting}
                  onClick={() => void submitAttendance()}
                >
                  {submitting ? "Registrando…" : "Registrar asistencia de abono"}
                </Button>
              ) : (
                <p className="rounded-2xl bg-ink/5 px-4 py-3 text-sm">
                  Este crédito está {credit.status === "COMPLETED" ? "completado" : "en mora"} y ya no
                  recibe asistencias.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink/70">Este cliente no tiene un crédito asociado.</p>
          )}
        </section>
      ) : (
        <p className="text-center text-sm text-ink/50">
          Apunta el lector al código de la tarjeta. El campo permanece enfocado para el escáner USB.
        </p>
      )}

      <Dialog open={lateOpen} onOpenChange={setLateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abono tardío</DialogTitle>
            <DialogDescription>
              Según el día de corte y los días de gracia, esta asistencia es tardía. La racha no suma.
              Elige si la conservas o la reinicias.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              disabled={submitting}
              onClick={() => void submitAttendance("KEEP")}
            >
              Mantener racha
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={submitting}
              onClick={() => void submitAttendance("RESET")}
            >
              Reiniciar racha a 0
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!prize} onOpenChange={(open) => !open && setPrize(null)}>
        <DialogContent className="overflow-hidden bg-forest text-cream">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            {Array.from({ length: 18 }).map((_, index) => (
              <span
                key={index}
                className="absolute h-2 w-2 rounded-full bg-gold confetti"
                style={{
                  left: `${(index * 17) % 100}%`,
                  animationDelay: `${index * 0.08}s`,
                }}
              />
            ))}
          </div>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-center text-gold">
              <Sparkles className="h-6 w-6" />
              ¡PREMIO DESBLOQUEADO!
            </DialogTitle>
            <DialogDescription className="text-center text-cream/75">
              {lookup?.customer.fullName} completó 5 abonos puntuales. {prize?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="gold"
              className="flex-1"
              onClick={async () => {
                if (!prize) return;
                await markRewardDelivered(prize.id);
                toast.success("Premio marcado como entregado");
                setPrize(null);
                focusScan();
              }}
            >
              Marcar Premio como Entregado Ahora
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-cream/20 bg-transparent text-cream hover:bg-white/10"
              onClick={() => {
                toast.message("El premio quedó pendiente de entrega");
                setPrize(null);
                focusScan();
              }}
            >
              Dejar Pendiente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
