/**
 * Limpieza one-shot de datos operativos / de ejemplo para el go-live.
 *
 * BORRA:
 *   - Clientes, créditos, abonos (asistencias), premios/evidencias (fotos)
 *   - Historial de lotes de impresión (CardPrintBatch)
 *   - Fondo/diseño subido en AppSettings (cardBackground*), nextCardSequence → 1
 *
 * CONSERVA:
 *   - Usuarios (ADMINISTRADOR, sucursales, etc.) y contraseñas
 *   - GiftTier (configuración de regalos 1/2/3)
 *   - AppSettings de ciclo/gracia/nombres (solo resetea secuencia y fondo de tarjetas)
 *   - Secretos / variables de entorno (no se tocan)
 *
 * Los 4 diseños preset CREDICEL (azul, blanco-azul, midnight, verde) viven en
 * código (`src/lib/card-designs.ts`), no en la BD: no se eliminan.
 *
 * Uso (desde la raíz del repo, con .env o variables exportadas):
 *
 *   # Solo cuenta qué se borraría (seguro):
 *   node scripts/wipe-operational-data.mjs
 *
 *   # Ejecutar de verdad:
 *   node scripts/wipe-operational-data.mjs --yes
 *
 * Producción (Supabase): exporta DATABASE_URL (y DIRECT_URL si aplica) de
 * Vercel/Supabase en tu shell local y corre con --yes. Nunca subas el .env.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

if (!process.env.DATABASE_URL) {
  console.error(
    "[wipe] Falta DATABASE_URL. Configúrala en .env o exporta la de Production.",
  );
  process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const execute = process.argv.includes("--yes");

async function counts() {
  const [customers, credits, payments, rewards, batches, users, giftTiers] =
    await Promise.all([
      prisma.customer.count(),
      prisma.credit.count(),
      prisma.payment.count(),
      prisma.reward.count(),
      prisma.cardPrintBatch.count(),
      prisma.user.count(),
      prisma.giftTier.count(),
    ]);
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: {
      nextCardSequence: true,
      cardBackgroundData: true,
      cardDesignId: true,
      cycleDays: true,
      graceDays: true,
    },
  });
  return {
    customers,
    credits,
    payments,
    rewards,
    batches,
    users,
    giftTiers,
    nextCardSequence: settings?.nextCardSequence ?? null,
    hasCardBackground: Boolean(settings?.cardBackgroundData?.length),
    cardDesignId: settings?.cardDesignId ?? null,
    cycleDays: settings?.cycleDays ?? null,
    graceDays: settings?.graceDays ?? null,
  };
}

function printSnapshot(label, snap) {
  console.log(`\n[${label}]`);
  console.log(`  Usuarios (se conservan):     ${snap.users}`);
  console.log(`  GiftTier (se conservan):     ${snap.giftTiers}`);
  console.log(`  Clientes:                    ${snap.customers}`);
  console.log(`  Créditos:                    ${snap.credits}`);
  console.log(`  Abonos/asistencias:          ${snap.payments}`);
  console.log(`  Premios/evidencias:          ${snap.rewards}`);
  console.log(`  Lotes de impresión:          ${snap.batches}`);
  console.log(`  nextCardSequence:            ${snap.nextCardSequence}`);
  console.log(
    `  Fondo/diseño en BD:           ${
      snap.hasCardBackground ? `sí (${snap.cardDesignId ?? "custom"})` : "no"
    }`,
  );
  console.log(`  cycleDays / graceDays:       ${snap.cycleDays} / ${snap.graceDays}`);
}

async function main() {
  console.log(
    execute
      ? "[wipe] MODO EJECUCIÓN (--yes): se borrarán datos operativos."
      : "[wipe] MODO DRY-RUN (sin --yes): solo se muestran conteos.",
  );

  const before = await counts();
  printSnapshot("Antes", before);

  if (!execute) {
    console.log(
      "\n[wipe] Nada se borró. Para ejecutar: node scripts/wipe-operational-data.mjs --yes",
    );
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Orden explícito por claridad (Customer ya hace cascade de Credit/Payment/Reward).
    const deletedRewards = await tx.reward.deleteMany({});
    const deletedPayments = await tx.payment.deleteMany({});
    const deletedCredits = await tx.credit.deleteMany({});
    const deletedCustomers = await tx.customer.deleteMany({});
    const deletedBatches = await tx.cardPrintBatch.deleteMany({});

    await tx.appSettings.upsert({
      where: { id: "default" },
      update: {
        nextCardSequence: 1,
        cardBackgroundData: null,
        cardBackgroundMimeType: null,
        cardDesignId: null,
      },
      create: {
        id: "default",
        cycleDays: 7,
        graceDays: 2,
        rewardEvery: 5,
        rewardName: "Regalo 1",
        nextCardSequence: 1,
      },
    });

    console.log("\n[wipe] Eliminados en esta corrida:");
    console.log(`  rewards:          ${deletedRewards.count}`);
    console.log(`  payments:         ${deletedPayments.count}`);
    console.log(`  credits:          ${deletedCredits.count}`);
    console.log(`  customers:        ${deletedCustomers.count}`);
    console.log(`  cardPrintBatches: ${deletedBatches.count}`);
    console.log("  appSettings:      nextCardSequence=1, fondo/diseño limpiados");
  });

  const after = await counts();
  printSnapshot("Después", after);

  if (after.users < 1) {
    console.warn(
      "[wipe] AVISO: no hay usuarios. Corre el seed (o Redeploy) para recrear ADMINISTRADOR/sucursales.",
    );
  } else {
    console.log(
      `\n[wipe] OK. ${after.users} usuario(s) intactos. Puedes iniciar sesión con normalidad.`,
    );
  }
  console.log(
    "[wipe] Nota: el seed ya no recrea clientes demo en deploys (salvo DEMO_SEED=1).",
  );
}

main()
  .catch((error) => {
    console.error("[wipe] Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
