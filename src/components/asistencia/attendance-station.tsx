"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ScanLine } from "lucide-react";
import {
  lookupByBarcode,
  registerAttendance,
  type AttendanceLookup,
  type LateDecision,
} from "@/app/actions/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StreakPips } from "@/components/streak-pips";
import { formatDate, formatMoney } from "@/lib/utils";
import { WebcamScanner } from "@/components/asistencia/webcam-scanner";
import { WinPhotoModal } from "@/components/rewards/win-photo-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Step = "info" | "confirm" | "late";

export function AttendanceStation() {
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lookup, setLookup] = useState<AttendanceLookup | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("info");
  const [error, setError] = useState<string | null>(null);
  const [prize, setPrize] = useState<{ id: string; name: string; customer: string } | null>(null);

  const focusScan = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    focusScan();
  }, [focusScan]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setStep("info");
    focusScan();
  }, [focusScan]);

  const runLookup = useCallback(
    async (value: string) => {
      const barcode = value.trim();
      if (!barcode) return;
      setLoading(true);
      setError(null);
      try {
        const result = await lookupByBarcode(barcode);
        if (!result.ok) {
          setLookup(null);
          setOpen(false);
          setError(result.error);
          toast.error(result.error);
          setQuery("");
          focusScan();
          return;
        }
        setLookup(result.data);
        setStep("info");
        setOpen(true);
        setQuery("");
      } catch {
        setError("No se pudo buscar el código. Intenta de nuevo.");
        focusScan();
      } finally {
        setLoading(false);
      }
    },
    [focusScan],
  );

  async function onScanSubmit(event: FormEvent) {
    event.preventDefault();
    await runLookup(query);
  }

  async function submitAttendance(lateDecision?: LateDecision) {
    if (!lookup?.credit || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await registerAttendance({
        creditId: lookup.credit.id,
        lateDecision,
        allowDuplicateToday: lookup.paidToday,
      });

      if (!result.ok && result.needsLateDecision) {
        setStep("late");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        if (result.needsDuplicateConfirm) {
          const fresh = await lookupByBarcode(lookup.customer.barcodeId);
          setLookup(fresh.ok ? fresh.data : { ...lookup, paidToday: true });
          setStep("info");
        }
        return;
      }

      toast.success(`Pago registrado: ${lookup.customer.fullName}. ${result.data.notes}`);
      const customerName = lookup.customer.fullName;
      closeModal();
      if (result.data.rewardUnlocked && result.data.rewardId) {
        setPrize({
          id: result.data.rewardId,
          name: result.data.rewardName ?? "Premio",
          customer: customerName,
        });
      }
    } catch {
      toast.error("No se pudo registrar el pago. Revisa la conexión e intenta de nuevo.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const credit = lookup?.credit;
  const canPay = credit?.status === "ACTIVE";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <form onSubmit={onScanSubmit} className="rounded-xl border border-line bg-white/80 p-5 shadow-sm">
        <label htmlFor="scan" className="mb-2 block text-sm font-medium text-ink/70">
          Lector USB o código manual
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand" />
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
        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>

      <p className="text-center text-sm text-muted">
        Apunta el lector al código de la tarjeta. Se abrirá la ficha del cliente para marcar el pago.
      </p>

      <Dialog
        open={open && !!lookup}
        onOpenChange={(next) => {
          if (!next && !submittingRef.current) closeModal();
        }}
      >
        <DialogContent
          className="max-h-[90vh] max-w-xl overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusScan();
          }}
        >
          {lookup ? (
            <>
              <DialogHeader>
                <DialogTitle>{lookup.customer.fullName}</DialogTitle>
                <DialogDescription>
                  <span className="font-mono text-brand">{lookup.customer.barcodeId}</span>
                  {" · "}
                  {lookup.punctuality.label}
                </DialogDescription>
              </DialogHeader>

              {step === "info" ? (
                <div className="space-y-4">
                  <div className="flex">
                    {lookup.punctuality.isOnTime ? (
                      <Badge tone="teal">Se registrará como puntual</Badge>
                    ) : (
                      <Badge tone="rose">Se registrará como tardío</Badge>
                    )}
                  </div>

                  {lookup.paidToday ? (
                    <div
                      role="alert"
                      className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
                    >
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold">Ya hay un abono registrado hoy</p>
                        <p>
                          {lookup.lastPayment
                            ? `${formatDate(lookup.lastPayment.at)}${lookup.lastPayment.byName ? ` · ${lookup.lastPayment.byName}` : ""}. `
                            : ""}
                          Si continúas, se te pedirá una confirmación extra para registrar otro.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-2xl bg-white p-4 text-sm sm:grid-cols-2">
                    <Info label="Código" value={lookup.customer.barcodeId} mono />
                    <Info label="Nombre" value={lookup.customer.fullName} />
                    <Info label="Número" value={lookup.customer.phone} />
                    <Info label="Plataforma" value={lookup.customer.platform} />
                    <Info label="Modelo" value={lookup.customer.model} />
                    <Info label="IMEI" value={lookup.customer.imei} mono />
                    <Info label="TAG/CURP" value={lookup.customer.tagCurp} mono />
                    <Info
                      label="Monto de abono"
                      value={credit ? formatMoney(credit.installmentAmount) : null}
                    />
                    <Info
                      label="Número de abono"
                      value={
                        credit
                          ? credit.totalInstallments > 0
                            ? `${Math.min(credit.paidInstallments + 1, credit.totalInstallments)} de ${credit.totalInstallments}`
                            : String(credit.paidInstallments + 1)
                          : null
                      }
                    />
                    <Info
                      label="Último abono"
                      value={
                        lookup.lastPayment
                          ? `${formatDate(lookup.lastPayment.at)}${lookup.lastPayment.byName ? ` · ${lookup.lastPayment.byName}` : ""}`
                          : "Sin abonos registrados"
                      }
                    />
                  </dl>

                  {credit ? (
                    <div>
                      <p className="mb-2 text-sm font-medium text-ink/70">
                        Racha actual: {credit.currentStreak}
                        {lookup.streakTarget ? `/${lookup.streakTarget}` : ""}
                      </p>
                      <StreakPips
                        current={credit.currentStreak}
                        total={lookup.streakTarget ?? Math.max(credit.currentStreak, 5)}
                        size="lg"
                      />
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-ink/5 px-4 py-3 text-sm">
                      Este cliente no tiene un crédito asociado.
                    </p>
                  )}

                  {credit && !canPay ? (
                    <p className="rounded-2xl bg-ink/5 px-4 py-3 text-sm">
                      Este crédito está {credit.status === "COMPLETED" ? "completado" : "en mora"} y ya
                      no recibe abonos.
                    </p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={closeModal}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      disabled={!canPay || submitting}
                      onClick={() => setStep("confirm")}
                    >
                      Marcar pago
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === "confirm" ? (
                <div className="space-y-4">
                  <p className="text-lg font-semibold">
                    ¿Confirmar pago de {lookup.customer.fullName}?
                  </p>
                  {lookup.paidToday ? (
                    <div
                      role="alert"
                      className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
                    >
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <p>
                        <strong>Ya se registró un abono hoy para este cliente.</strong> ¿Seguro que
                        quieres registrar OTRO abono el mismo día?
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={submitting}
                      onClick={() => setStep("info")}
                    >
                      Volver
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant={lookup.paidToday ? "danger" : "default"}
                      disabled={submitting}
                      onClick={() => void submitAttendance()}
                    >
                      {submitting
                        ? "Registrando…"
                        : lookup.paidToday
                          ? "Sí, registrar otro abono hoy"
                          : "Sí, confirmar pago"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === "late" ? (
                <div className="space-y-4">
                  <p className="text-sm text-ink/75">
                    <strong>Abono tardío.</strong> Según el día de corte y los días de gracia, este
                    abono es tardío y la racha no suma. Elige si la conservas o la reinicias.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
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
                  <Button type="button" variant="ghost" disabled={submitting} onClick={closeModal}>
                    Cancelar
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <WinPhotoModal
        prize={prize}
        onClose={() => {
          setPrize(null);
          focusScan();
        }}
      />
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className={mono ? "break-all font-mono text-xs" : "font-medium"}>{value || "—"}</dd>
    </div>
  );
}
