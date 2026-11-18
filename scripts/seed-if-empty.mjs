import { spawnSync } from "node:child_process";

// Asegura usuarios iniciales + GiftTier. Los clientes demo solo si DEMO_SEED=1.
// Si falla, el build continúa.
const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  console.warn(
    "[seed] No se pudo ejecutar el seed (usuarios iniciales) (se ignora, el build continúa). " +
      "Vuelve a hacer Redeploy cuando la base responda para crear los usuarios iniciales.",
  );
}
process.exit(0);
