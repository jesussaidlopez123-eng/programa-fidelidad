import { PrismaClient, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const INITIAL_PASSWORD = "0000";
const INITIAL_USERS: { name: string; role: UserRole }[] = [
  { name: "HUATABAMPO", role: "SUCURSAL" },
  { name: "HUATABAMPO 2", role: "SUCURSAL" },
  { name: "ALLENDE", role: "SUCURSAL" },
  { name: "MERCADO", role: "SUCURSAL" },
  { name: "MERCADO 2", role: "SUCURSAL" },
  { name: "ALAMOS", role: "SUCURSAL" },
  { name: "ADMINISTRADOR", role: "ADMIN" },
  { name: "ADMINISTRADOR 2", role: "ADMIN" },
];

// Crea los usuarios iniciales que falten (por nombre). Nunca toca contraseñas ni usuarios existentes.
async function ensureUsers() {
  const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, 10);
  let created = 0;
  for (const user of INITIAL_USERS) {
    const exists = await prisma.user.findUnique({ where: { name: user.name } });
    if (exists) continue;
    await prisma.user.create({ data: { ...user, passwordHash } });
    created += 1;
  }
  console.log(
    created > 0
      ? `[seed] Usuarios creados: ${created} (contraseña temporal ${INITIAL_PASSWORD}).`
      : "[seed] Los usuarios iniciales ya existen.",
  );
}

async function ensureGiftTiers() {
  const defaults = [
    { id: "gift-tier-1", slot: 1, name: "Regalo 1", description: "", marksRequired: 5 },
    { id: "gift-tier-2", slot: 2, name: "Regalo 2", description: "", marksRequired: 10 },
    { id: "gift-tier-3", slot: 3, name: "Regalo 3", description: "", marksRequired: 15 },
  ];
  for (const tier of defaults) {
    await prisma.giftTier.upsert({
      where: { slot: tier.slot },
      update: {},
      create: tier,
    });
  }
  console.log("[seed] GiftTier 1/2/3 asegurados (5, 10, 15 marcas).");
}

async function main() {
  await ensureUsers();

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      cycleDays: 7,
      graceDays: 2,
      rewardEvery: 5,
      rewardName: "Regalo 1",
    },
  });

  await ensureGiftTiers();

  const existingCustomers = await prisma.customer.count();
  if (existingCustomers > 0) {
    console.log(`[seed] La base ya tiene ${existingCustomers} cliente(s); no se agrega nada.`);
    return;
  }

  const maria = await prisma.customer.create({
    data: {
      fullName: "María Elena Vargas",
      phone: "555-101-0123",
      email: "maria.vargas@correo.mx",
      barcodeId: "CRD-000123",
      credits: {
        create: {
          concept: "Electrodomésticos — línea blanca",
          totalAmount: 12000,
          balance: 8000,
          installmentAmount: 1000,
          totalInstallments: 12,
          paidInstallments: 4,
          currentStreak: 4,
          status: "ACTIVE",
        },
      },
    },
    include: { credits: true },
  });

  const mariaCredit = maria.credits[0];
  const mariaBase = new Date();
  mariaBase.setDate(mariaBase.getDate() - 28);
  for (let i = 0; i < 4; i++) {
    const paymentDate = new Date(mariaBase);
    paymentDate.setDate(mariaBase.getDate() + i * 7);
    await prisma.payment.create({
      data: {
        creditId: mariaCredit.id,
        amount: 1000,
        paymentDate,
        isOnTime: true,
        streakCountAfterPayment: i + 1,
        notes: "Abono puntual (demo)",
      },
    });
  }

  await prisma.customer.create({
    data: {
      fullName: "Carlos Méndez Soto",
      phone: "555-202-0456",
      email: "carlos.mendez@correo.mx",
      barcodeId: "CRD-000124",
      credits: {
        create: {
          concept: "Muebles de sala",
          totalAmount: 8500,
          balance: 6800,
          installmentAmount: 850,
          totalInstallments: 10,
          paidInstallments: 2,
          currentStreak: 2,
          status: "ACTIVE",
          payments: {
            create: [
              {
                amount: 850,
                isOnTime: true,
                streakCountAfterPayment: 1,
                notes: "Abono puntual (demo)",
                paymentDate: daysAgo(20),
              },
              {
                amount: 850,
                isOnTime: true,
                streakCountAfterPayment: 2,
                notes: "Abono puntual (demo)",
                paymentDate: daysAgo(6),
              },
            ],
          },
        },
      },
    },
  });

  await prisma.customer.create({
    data: {
      fullName: "Ana Sofía Ruiz",
      phone: "555-303-0789",
      email: "ana.ruiz@correo.mx",
      barcodeId: "CRD-000125",
      credits: {
        create: {
          concept: "Smartphone a meses",
          totalAmount: 7200,
          balance: 7200,
          installmentAmount: 600,
          totalInstallments: 12,
          paidInstallments: 0,
          currentStreak: 0,
          status: "ACTIVE",
        },
      },
    },
  });

  await prisma.customer.create({
    data: {
      fullName: "José Luis Herrera",
      phone: "555-404-0110",
      email: "jose.herrera@correo.mx",
      barcodeId: "CRD-000126",
      credits: {
        create: {
          concept: "Refacción automotriz",
          totalAmount: 9600,
          balance: 3200,
          installmentAmount: 800,
          totalInstallments: 12,
          paidInstallments: 8,
          currentStreak: 3,
          status: "ACTIVE",
          payments: {
            create: Array.from({ length: 8 }).map((_, i) => ({
              amount: 800,
              isOnTime: i >= 5,
              streakCountAfterPayment: i >= 5 ? i - 4 : 0,
              notes: i >= 5 ? "Abono puntual (demo)" : "Abono tardío (demo)",
              paymentDate: daysAgo(70 - i * 7),
            })),
          },
        },
      },
    },
  });

  const lucia = await prisma.customer.create({
    data: {
      fullName: "Lucía Peña Navarro",
      phone: "555-505-0141",
      email: "lucia.pena@correo.mx",
      barcodeId: "CRD-000127",
      credits: {
        create: {
          concept: "Colchón y base",
          totalAmount: 5400,
          balance: 2700,
          installmentAmount: 900,
          totalInstallments: 6,
          paidInstallments: 6,
          currentStreak: 1,
          status: "COMPLETED",
        },
      },
    },
    include: { credits: true },
  });

  const luciaCredit = lucia.credits[0];
  for (let i = 0; i < 6; i++) {
    const onTime = i !== 4;
    await prisma.payment.create({
      data: {
        creditId: luciaCredit.id,
        amount: 900,
        paymentDate: daysAgo(90 - i * 14),
        isOnTime: onTime,
        streakCountAfterPayment: i === 4 ? 0 : i < 4 ? i + 1 : 1,
        notes: onTime ? "Abono puntual (demo)" : "Tardío: racha reiniciada (demo)",
      },
    });
  }

  await prisma.reward.create({
    data: {
      customerId: lucia.id,
      creditId: luciaCredit.id,
      rewardName: "Regalo 1",
      status: "PENDING",
      unlockedAt: daysAgo(20),
      giftSlot: 1,
      marksRequired: 5,
    },
  });

  console.log("Seed listo. Cliente en racha 4: María Elena Vargas · CRD-000123 (siguiente puntual = Regalo 1)");
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
