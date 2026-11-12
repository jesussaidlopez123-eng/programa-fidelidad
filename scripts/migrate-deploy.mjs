import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

const timeoutMs = Number(process.env.MIGRATE_TIMEOUT_MS) || 120_000;
const env = { ...process.env };

// Evita esperas indefinidas al abrir la conexión de migración.
const direct = new URL(env.DIRECT_URL);
if (!direct.searchParams.has("connect_timeout")) direct.searchParams.set("connect_timeout", "20");
env.DIRECT_URL = direct.toString();

const child = spawn(process.execPath, [prismaCli, "migrate", "deploy"], {
  stdio: "inherit",
  env,
  detached: process.platform !== "win32",
});

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  try {
    if (process.platform === "win32") child.kill("SIGKILL");
    else process.kill(-child.pid, "SIGKILL");
  } catch {}
}, timeoutMs);

child.on("exit", (code) => {
  clearTimeout(timer);
  if (code === 0 && !timedOut) process.exit(0);

  console.error("");
  console.error("==============================================================");
  console.error(
    timedOut
      ? ` ERROR: las migraciones tardaron más de ${Math.round(timeoutMs / 1000)} segundos y se cancelaron`
      : " ERROR: falló `prisma migrate deploy`",
  );
  console.error("==============================================================");
  console.error(" Causas más comunes:");
  console.error("  - DIRECT_URL apunta al puerto 6543 (Transaction pooler). Debe ser el");
  console.error("    Session pooler de Supabase: host *.pooler.supabase.com, puerto 5432.");
  console.error("  - Contraseña incorrecta o con caracteres especiales sin codificar.");
  console.error("  - El proyecto de Supabase está pausado.");
  console.error(" Corrige DIRECT_URL en Vercel → Settings → Environment Variables y haz Redeploy.");
  console.error("==============================================================");
  process.exit(1);
});
