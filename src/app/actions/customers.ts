"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { normalizeBarcode } from "@/lib/utils";

export async function listCustomers() {
  await requireUser(["ADMIN"]);
  return prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      credits: {
        orderBy: { createdAt: "desc" },
      },
      rewards: {
        where: { status: "PENDING" },
      },
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

export async function createCustomerWithCredit(formData: FormData) {
  const user = await requireUser();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const concept = String(formData.get("concept") ?? "").trim();
  const totalAmount = Number(formData.get("totalAmount") ?? 0);
  const installmentAmount = Number(formData.get("installmentAmount") ?? 0);
  const totalInstallments = Number.parseInt(String(formData.get("totalInstallments") ?? "0"), 10);

  if (!fullName) {
    return { ok: false as const, error: "El nombre es obligatorio." };
  }
  if (!concept) {
    return { ok: false as const, error: "El concepto del crédito es obligatorio." };
  }
  if (!totalAmount || totalAmount <= 0) {
    return { ok: false as const, error: "Indica un monto total válido." };
  }
  if (!totalInstallments || totalInstallments <= 0) {
    return { ok: false as const, error: "Indica el número de abonos." };
  }

  const barcodeId = await nextBarcodeId();

  const customer = await prisma.customer.create({
    data: {
      fullName,
      phone,
      email,
      barcodeId,
      createdById: user.id,
      createdByName: user.name,
      credits: {
        create: {
          concept,
          totalAmount,
          balance: totalAmount,
          installmentAmount: installmentAmount > 0 ? installmentAmount : totalAmount / totalInstallments,
          totalInstallments,
          paidInstallments: 0,
          currentStreak: 0,
          status: "ACTIVE",
        },
      },
    },
  });

  revalidatePath("/customers");
  revalidatePath("/");
  return { ok: true as const, customerId: customer.id, barcodeId };
}

async function nextBarcodeId() {
  const customers = await prisma.customer.findMany({
    select: { barcodeId: true },
  });
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
