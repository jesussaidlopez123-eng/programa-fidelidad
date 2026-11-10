"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createCustomerWithCredit } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomerForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <form
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
