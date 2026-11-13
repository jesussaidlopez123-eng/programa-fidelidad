"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ScanLine } from "lucide-react";
import {
  checkBarcode,
  createCustomerWithCredit,
  generateBarcode,
} from "@/app/actions/customers";
import { WebcamScanner } from "@/components/asistencia/webcam-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Created = { customerId: string; barcodeId: string; fullName: string };

export function CustomerForm() {
  const scanRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [barcodeId, setBarcodeId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const focusScan = useCallback(() => {
    window.setTimeout(() => scanRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (!barcodeId) focusScan();
  }, [barcodeId, focusScan]);

  const acceptCode = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      setChecking(true);
      setScanError(null);
      try {
        const result = await checkBarcode(value);
        if (!result.ok) {
          setScanError(result.error);
          toast.error(result.error);
          setCode("");
          focusScan();
          return;
        }
        setBarcodeId(result.barcodeId);
        setCode("");
      } catch {
        setScanError("No se pudo validar el código. Intenta de nuevo.");
      } finally {
        setChecking(false);
      }
    },
    [focusScan],
  );

  if (barcodeId) {
    return (
      <CustomerDetailsForm
        barcodeId={barcodeId}
        onCancel={() => setBarcodeId(null)}
        onSaved={(info) => {
          setCreated(info);
          setBarcodeId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {created ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/25 bg-brand/10 p-5">
          <div>
            <p className="font-semibold text-brand">Cliente guardado: {created.fullName}</p>
            <p className="font-mono text-sm text-brand">{created.barcodeId}</p>
            <p className="mt-1 text-sm text-muted">Escanea la siguiente tarjeta para continuar.</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/print/${created.customerId}`}>Imprimir tarjeta</Link>
          </Button>
        </div>
      ) : null}

      <form
        className="rounded-xl border border-line bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void acceptCode(code);
        }}
      >
        <label htmlFor="scan-new" className="mb-3 block font-display text-2xl font-semibold text-ink">
          Escanear tarjeta nueva
        </label>
        <div className="relative">
          <ScanLine className="pointer-events-none absolute left-4 top-1/2 h-7 w-7 -translate-y-1/2 text-brand" />
          <Input
            id="scan-new"
            ref={scanRef}
            autoFocus
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Escanea la tarjeta y presiona Enter…"
            className="h-20 pl-14 font-mono text-2xl tracking-wide"
          />
        </div>
        {scanError ? (
          <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {scanError}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <WebcamScanner onScan={(value) => void acceptCode(value)} />
          <Button type="submit" disabled={checking || !code.trim()}>
            {checking ? "Validando…" : "Continuar"}
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted">
          ¿No tienes tarjeta física con código?{" "}
          <button
            type="button"
            className="font-semibold text-brand underline"
            onClick={async () => {
              const result = await generateBarcode();
              setBarcodeId(result.barcodeId);
            }}
          >
            generar código automático
          </button>
        </p>
      </form>
    </div>
  );
}

function CustomerDetailsForm({
  barcodeId,
  onCancel,
  onSaved,
}: {
  barcodeId: string;
  onCancel: () => void;
  onSaved: (info: Created) => void;
}) {
  const [pending, setPending] = useState(false);
  const [imeiWarning, setImeiWarning] = useState<string | null>(null);

  function checkImei(value: string) {
    const digits = value.replace(/[\s-]/g, "");
    if (digits && !/^\d{15}$/.test(digits)) {
      setImeiWarning("El IMEI normalmente tiene 15 dígitos numéricos. Revísalo.");
    } else {
      setImeiWarning(null);
    }
  }

  return (
    <form
      className="grid gap-4 rounded-xl border border-line bg-white p-6 shadow-sm md:grid-cols-2"
      action={async (formData) => {
        setPending(true);
        try {
          let result = await createCustomerWithCredit(formData);
          if (!result.ok && result.needsImeiConfirm) {
            if (window.confirm(`${result.error}\n\n¿Guardar el cliente con este IMEI de todos modos?`)) {
              formData.set("imeiConfirmed", "1");
              result = await createCustomerWithCredit(formData);
            } else {
              return;
            }
          }
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`Cliente guardado · ${result.barcodeId}`);
          onSaved({
            customerId: result.customerId,
            barcodeId: result.barcodeId,
            fullName: String(formData.get("fullName") ?? ""),
          });
        } catch {
          toast.error("No se pudo guardar el cliente. Intenta de nuevo.");
        } finally {
          setPending(false);
        }
      }}
    >
      <input type="hidden" name="barcodeId" value={barcodeId} />
      <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
        <div>
          <h2 className="font-display text-2xl font-semibold">Datos del cliente</h2>
          <p className="text-sm text-muted">
            Tarjeta: <span className="font-mono font-semibold text-brand">{barcodeId}</span>
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
          Cambiar tarjeta
        </Button>
      </div>

      <Field label="Nombre" name="fullName" required autoFocus placeholder="Nombre completo" />
      <Field label="Número" name="phone" type="tel" required placeholder="Teléfono" />
      <div className="space-y-1.5">
        <Label htmlFor="platform">Plataforma</Label>
        <select
          id="platform"
          name="platform"
          required
          defaultValue=""
          className="flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
        >
          <option value="" disabled>
            Selecciona…
          </option>
          <option value="PAYJOY">PAYJOY</option>
          <option value="KREDIYA">KREDIYA</option>
        </select>
      </div>
      <Field label="Modelo" name="model" required placeholder="Ej. Samsung A15" />
      <div className="space-y-1.5">
        <Label htmlFor="imei">IMEI</Label>
        <Input
          id="imei"
          name="imei"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="15 dígitos"
          onBlur={(event) => checkImei(event.target.value)}
          onChange={(event) => imeiWarning && checkImei(event.target.value)}
        />
        {imeiWarning ? <p className="text-xs text-amber-700">{imeiWarning}</p> : null}
      </div>
      <Field label="TAG/CURP" name="tagCurp" required autoComplete="off" placeholder="TAG o CURP" />
      <Field
        label="Monto de abono"
        name="installmentAmount"
        type="number"
        min="0.01"
        step="0.01"
        required
        placeholder="Monto de cada abono (solo registro)"
      />
      <Field
        label="Semanas totales"
        name="totalWeeks"
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        required
        placeholder="Plazo del crédito en semanas"
      />
      <div className="flex flex-wrap gap-3 md:col-span-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cliente"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
