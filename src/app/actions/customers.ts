"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma, type Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { normalizeBarcode } from "@/lib/utils";

const MAX_BARCODE_LENGTH = 64;

export async function listCustomers() {
  await requireUser(["ADMIN"]);
  return prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      credits: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { payments: true } } },
      },
      rewards: true,
    },
  });
}

export async function getCustomer(id: string) {
  await requireUser();
  return prisma.customer.findUnique({
    where: { id },
    include: {
      credits: { orderBy: { createdAt: "desc" } },
      rewards: { orderBy: { unlockedAt: "desc" } },
    },
  });
}

export type BarcodeCheck =
  | { ok: true; barcodeId: string }
  | { ok: false; error: string };

export async function checkBarcode(raw: string): Promise<BarcodeCheck> {
  await requireUser();
  const barcodeId = normalizeBarcode(raw);
  if (!barcodeId) return { ok: false, error: "Escanea o escribe el código de la tarjeta." };
  if (barcodeId.length > MAX_BARCODE_LENGTH) {
    return { ok: false, error: `El código es demasiado largo (máximo ${MAX_BARCODE_LENGTH}).` };
  }
  const owner = await prisma.customer.findUnique({
    where: { barcodeId },
    select: { fullName: true },
  });
  if (owner) {
    return {
      ok: false,
      error: `El código ${barcodeId} ya pertenece al cliente ${owner.fullName}. Usa otra tarjeta.`,
    };
  }
  return { ok: true, barcodeId };
}

export async function generateBarcode(): Promise<{ ok: true; barcodeId: string }> {
  await requireUser();
  return { ok: true, barcodeId: await nextBarcodeId() };
}

export type CreateCustomerResult =
  | { ok: true; customerId: string; barcodeId: string }
  | { ok: false; error: string; needsImeiConfirm?: boolean };

export async function createCustomerWithCredit(formData: FormData): Promise<CreateCustomerResult> {
  const user = await requireUser();

  const barcodeId = normalizeBarcode(String(formData.get("barcodeId") ?? ""));
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const platformRaw = String(formData.get("platform") ?? "");
  const model = String(formData.get("model") ?? "").trim();
  const imei = String(formData.get("imei") ?? "").replace(/[\s-]/g, "");
  const tagCurp = String(formData.get("tagCurp") ?? "").trim().toUpperCase();
  const installmentAmount = Number(formData.get("installmentAmount") ?? 0);
  const imeiConfirmed = formData.get("imeiConfirmed") === "1";

  if (!barcodeId) return { ok: false, error: "Falta el código de la tarjeta. Escanéala primero." };
  if (barcodeId.length > MAX_BARCODE_LENGTH) {
    return { ok: false, error: "El código de la tarjeta es demasiado largo." };
  }
  if (!fullName) return { ok: false, error: "El nombre es obligatorio." };
  if (!phone) return { ok: false, error: "El número de teléfono es obligatorio." };
  if (platformRaw !== "PAYJOY" && platformRaw !== "KREDIYA") {
    return { ok: false, error: "Elige la plataforma (PAYJOY o KREDIYA)." };
  }
  const platform: Platform = platformRaw;
  if (!model) return { ok: false, error: "El modelo es obligatorio." };
  if (!imei) return { ok: false, error: "El IMEI es obligatorio." };
  if (!tagCurp) return { ok: false, error: "El TAG/CURP es obligatorio." };
  if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) {
    return { ok: false, error: "Indica un monto de abono válido." };
  }

  if (!/^\d{15}$/.test(imei) && !imeiConfirmed) {
    return {
      ok: false,
      needsImeiConfirm: true,
      error: "El IMEI normalmente tiene 15 dígitos numéricos. Revísalo o confirma que es correcto.",
    };
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        fullName,
        phone,
        barcodeId,
        platform,
        model,
        imei,
        tagCurp,
        createdById: user.id,
        createdByName: user.name,
        credits: {
          create: {
            concept: `${platform} · ${model}`,
            totalAmount: 0,
            balance: 0,
            installmentAmount,
            totalInstallments: 0,
            paidInstallments: 0,
            currentStreak: 0,
            status: "ACTIVE",
          },
        },
      },
    });

    revalidatePath("/customers");
    revalidatePath("/");
    return { ok: true, customerId: customer.id, barcodeId };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const owner = await prisma.customer.findUnique({
        where: { barcodeId },
        select: { fullName: true },
      });
      return {
        ok: false,
        error: owner
          ? `El código ${barcodeId} ya pertenece al cliente ${owner.fullName}.`
          : `El código ${barcodeId} ya está en uso.`,
      };
    }
    throw error;
  }
}

export async function deleteCustomer(
  customerId: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireUser(["ADMIN"]);
  if (!password) return { ok: false, error: "Escribe tu contraseña para confirmar." };

  const account = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { passwordHash: true },
  });
  const valid = account ? await bcrypt.compare(password, account.passwordHash) : false;
  if (!valid) return { ok: false, error: "Contraseña incorrecta. No se eliminó nada." };

  try {
    // Créditos, pagos y premios se eliminan en cascada (onDelete: Cascade en el esquema).
    await prisma.customer.delete({ where: { id: customerId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: "El cliente ya no existe." };
    }
    throw error;
  }

  revalidatePath("/customers");
  revalidatePath("/rewards");
  revalidatePath("/");
  return { ok: true };
}

async function nextBarcodeId() {
  const customers = await prisma.customer.findMany({ select: { barcodeId: true } });
  const used = new Set(customers.map((item) => item.barcodeId));
  let sequence = customers.length + 1;
  let candidate = formatBarcode(sequence);
  while (used.has(candidate)) {
    sequence += 1;
    candidate = formatBarcode(sequence);
  }
  return normalizeBarcode(candidate);
}

function formatBarcode(sequence: number) {
  return `CRD-${String(sequence).padStart(6, "0")}`;
}
