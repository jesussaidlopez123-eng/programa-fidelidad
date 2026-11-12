import { spawnSync } from "node:child_process";

// Crea los usuarios iniciales que falten y, si no hay clientes, los datos de demostración.
// Si falla, el build continúa.
const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  console.warn(
    "[seed] No se pudo ejecutar el seed (usuarios iniciales / datos de demostración) (se ignora, el build continúa). " +
      "Vuelve a hacer Redeploy cuando la base responda para crear los usuarios iniciales.",
  );
}
process.exit(0);
