"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createCustomerWithCredit } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomerForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ customerId: string; barcodeId: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      {created ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-teal/30 bg-teal/10 p-5">
          <div>
            <p className="font-semibold text-forest">Cliente dado de alta</p>
            <p className="font-mono text-sm text-teal">{created.barcodeId}</p>
          </div>
          <Button asChild>
            <Link href={`/print/${created.customerId}`}>Imprimir tarjeta</Link>
          </Button>
        </div>
      ) : null}
    <form
      ref={formRef}
      className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-sm md:grid-cols-2"
      action={async (formData) => {
        setPending(true);
        const result = await createCustomerWithCredit(formData);
        setPending(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(`Cliente dado de alta · ${result.barcodeId}`);
        setCreated({ customerId: result.customerId, barcodeId: result.barcodeId });
        formRef.current?.reset();
        router.refresh();
      }}
    >
      <h2 className="font-display text-2xl md:col-span-2">Alta de cliente y crédito</h2>
      <Field label="Nombre completo" name="fullName" required placeholder="Nombre y apellidos" />
      <Field label="Teléfono" name="phone" placeholder="555-000-0000" />
      <Field label="Correo" name="email" type="email" placeholder="correo@dominio.mx" />
      <Field label="Concepto del crédito" name="concept" required placeholder="Ej. Línea blanca" />
      <Field label="Monto total" name="totalAmount" type="number" min="1" step="0.01" required />
      <Field
        label="Monto de cada abono (informativo)"
        name="installmentAmount"
        type="number"
        min="0"
        step="0.01"
      />
      <Field label="Número de abonos" name="totalInstallments" type="number" min="1" required />
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Crear cliente y generar código"}
        </Button>
      </div>
    </form>
    </div>
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
