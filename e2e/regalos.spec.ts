import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function login(page: Page, name: string, password = "0000") {
  await page.goto("/login");
  await page.getByLabel(/usuario/i).fill(name);
  await page.getByLabel(/contraseña/i).fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login")),
    page.getByRole("button", { name: /entrar|iniciar/i }).click(),
  ]);
  await expect(page.getByRole("button", { name: /cerrar sesión/i })).toBeVisible();
}

async function logout(page: Page) {
  await Promise.all([
    page.waitForURL(/\/login/),
    page.getByRole("button", { name: /cerrar sesión/i }).click(),
  ]);
}

test.describe("Regalos, asistencia, evidencias y foto", () => {
  test.beforeAll(async () => {
    await prisma.$connect();
    // Asegura GiftTier y un cliente listo para ganar el Regalo 1 (racha 4 → 5).
    for (const tier of [
      { id: "gift-tier-1", slot: 1, name: "Regalo 1", description: "Premio prueba", marksRequired: 5 },
      { id: "gift-tier-2", slot: 2, name: "Regalo 2", description: "", marksRequired: 10 },
      { id: "gift-tier-3", slot: 3, name: "Regalo 3", description: "", marksRequired: 15 },
    ]) {
      await prisma.giftTier.upsert({
        where: { slot: tier.slot },
        update: {
          name: tier.name,
          description: tier.description,
          marksRequired: tier.marksRequired,
        },
        create: tier,
      });
    }

    const passwordHash = await bcrypt.hash("0000", 10);
    await prisma.user.upsert({
      where: { name: "ADMINISTRADOR" },
      update: {},
      create: { name: "ADMINISTRADOR", role: "ADMIN", passwordHash },
    });
    await prisma.user.upsert({
      where: { name: "HUATABAMPO" },
      update: {},
      create: { name: "HUATABAMPO", role: "SUCURSAL", passwordHash },
    });

    await prisma.customer.deleteMany({ where: { barcodeId: "CRD-E2E001" } });
    await prisma.customer.create({
      data: {
        fullName: "Cliente E2E Ganador",
        phone: "555-000-9999",
        barcodeId: "CRD-E2E001",
        platform: "PAYJOY",
        model: "Demo Phone",
        imei: "123456789012345",
        tagCurp: "E2ETEST001",
        createdByName: "HUATABAMPO",
        credits: {
          create: {
            concept: "PAYJOY · Demo Phone",
            totalAmount: 0,
            balance: 0,
            installmentAmount: 500,
            totalInstallments: 0,
            paidInstallments: 4,
            currentStreak: 4,
            status: "ACTIVE",
          },
        },
      },
    });
  });

  test.afterAll(async () => {
    await prisma.customer.deleteMany({ where: { barcodeId: { in: ["CRD-E2E001", "CRD-E2EMOD"] } } });
    await prisma.$disconnect();
  });

  test("admin guarda los 3 regalos y persisten tras recargar (incl. desactivar)", async ({
    page,
  }) => {
    await login(page, "ADMINISTRADOR");
    await page.goto("/rewards");
    await expect(page.getByRole("heading", { name: "Regalos", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Configuración de regalos" })).toBeVisible();

    await page.locator("#gift-name-1").fill("Audífonos E2E");
    await page.locator("#gift-name-2").fill("Bocina E2E");
    await page.locator("#gift-name-3").fill("Tablet E2E");
    await page.locator("#gift-desc-1").fill("Inalámbricos");
    await page.locator("#gift-marks-1").fill("5");
    await page.locator("#gift-marks-2").fill("10");
    await page.locator("#gift-marks-3").fill("15");

    await page.getByRole("button", { name: /guardar regalos/i }).click();
    await expect(page.getByText("Configuración de regalos guardada")).toBeVisible({
      timeout: 10_000,
    });

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#gift-name-1")).toHaveValue("Audífonos E2E");
    await expect(page.locator("#gift-name-2")).toHaveValue("Bocina E2E");
    await expect(page.locator("#gift-name-3")).toHaveValue("Tablet E2E");
    await expect(page.locator("#gift-marks-1")).toHaveValue("5");
    await expect(page.locator("#gift-marks-2")).toHaveValue("10");
    await expect(page.locator("#gift-marks-3")).toHaveValue("15");

    // Desactivar Regalo 3 (vacío) debe persistir vacío — no volver a 15.
    await page.locator("#gift-marks-3").fill("");
    await page.getByRole("button", { name: /guardar regalos/i }).click();
    await expect(page.getByText("Configuración de regalos guardada")).toBeVisible({
      timeout: 10_000,
    });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#gift-marks-3")).toHaveValue("");
    await expect(page.locator("#gift-name-3")).toHaveValue("Tablet E2E");

    const tier3 = await prisma.giftTier.findUnique({ where: { slot: 3 } });
    expect(tier3?.marksRequired).toBeNull();

    // Restaurar para el resto de la suite.
    await page.locator("#gift-marks-3").fill("15");
    await page.locator("#gift-name-1").fill("Regalo 1");
    await page.locator("#gift-name-2").fill("Regalo 2");
    await page.locator("#gift-name-3").fill("Regalo 3");
    await page.locator("#gift-desc-1").fill("Premio prueba");
    await page.getByRole("button", { name: /guardar regalos/i }).click();
    await expect(page.getByText("Configuración de regalos guardada")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("alta de cliente persiste el campo Modelo", async ({ page }) => {
    await login(page, "HUATABAMPO");
    await page.goto("/alta");
    await page.getByRole("button", { name: /generar código automático/i }).click();
    await page.getByLabel(/^Nombre$/i).waitFor();

    const stamp = Date.now().toString().slice(-6);
    const model = `Modelo-E2E-${stamp}`;
    await page.getByLabel(/^Nombre$/i).fill(`Cliente Modelo ${stamp}`);
    await page.getByLabel(/^Número$/i).fill("5559876543");
    await page.locator("#platform").selectOption("KREDIYA");
    await page.getByLabel(/^Modelo$/i).fill(model);
    await page.getByLabel(/^IMEI$/i).fill("352222222222222");
    await page.getByLabel(/TAG\/CURP/i).fill(`MODE2E${stamp}`);
    await page.getByLabel(/Monto de abono/i).fill("350");
    await page.getByRole("button", { name: /guardar cliente/i }).click();
    await expect(page.getByText(`Cliente guardado: Cliente Modelo ${stamp}`)).toBeVisible({
      timeout: 10_000,
    });

    const saved = await prisma.customer.findFirst({
      where: { fullName: `Cliente Modelo ${stamp}` },
      select: { id: true, model: true, barcodeId: true },
    });
    expect(saved?.model).toBe(model);

    await logout(page);
    await login(page, "ADMINISTRADOR");
    await page.goto(`/customers/${saved!.id}`, { waitUntil: "networkidle" });
    await expect(page.getByText(model, { exact: true })).toBeVisible();

    await prisma.customer.delete({ where: { id: saved!.id } }).catch(() => undefined);
  });

  test("abono puntual desbloquea regalo, evidencias y foto en ficha", async ({ page }) => {
    await login(page, "HUATABAMPO");
    await page.goto("/asistencia");

    await page.getByLabel(/lector usb|código/i).fill("CRD-E2E001");
    await page.getByRole("button", { name: /buscar/i }).click();
    await expect(page.getByRole("heading", { name: "Cliente E2E Ganador" })).toBeVisible();

    await page.getByRole("button", { name: /marcar pago/i }).click();
    await page.getByRole("button", { name: /sí, confirmar pago/i }).click();

    await expect(page.getByText("¡EL CLIENTE GANÓ!")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Cliente E2E Ganador", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /subir después/i }).click();

    await page.goto("/evidencias");
    await expect(page.getByRole("heading", { name: "Evidencias", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cliente E2E Ganador", exact: true })).toBeVisible();

    const card = page.locator("article").filter({ hasText: "Cliente E2E Ganador" });
    await card.locator('input[type="file"]').first().setInputFiles("e2e/premio.jpg");
    await expect(card.locator("img[alt='Vista previa']")).toBeVisible({ timeout: 15_000 });
    await card.getByRole("button", { name: /^subir foto$/i }).click();
    await expect(card).toHaveCount(0, { timeout: 20_000 });

    const reward = await prisma.reward.findFirst({
      where: { customer: { barcodeId: "CRD-E2E001" } },
      orderBy: { unlockedAt: "desc" },
      select: { id: true, photoUploadedAt: true, photoData: true, customerId: true },
    });
    expect(reward?.photoUploadedAt).not.toBeNull();
    expect(reward?.photoData?.length ?? 0).toBeGreaterThan(0);

    await logout(page);
    await login(page, "ADMINISTRADOR");
    // Esperar a que el client router del login termine antes de ir a la ficha.
    await page.waitForLoadState("networkidle");
    await page.goto(`/customers/${reward!.customerId}`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(new RegExp(`/customers/${reward!.customerId}`));
    await expect(page.getByRole("heading", { name: "Cliente E2E Ganador", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fotos de premios" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Historial de regalos" })).toBeVisible();
    await expect(page.locator(`img[src="/api/rewards/${reward!.id}/photo"]`).first()).toBeVisible();
  });
});
