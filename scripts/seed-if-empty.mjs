import { spawnSync } from "node:child_process";

// El seed es opcional: si falla, el build continúa.
const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  console.warn(
    "[seed] No se pudo cargar los datos de demostración (se ignora, el build continúa). " +
      "La app funciona sin ellos; puedes crear clientes desde /customers.",
  );
}
process.exit(0);
