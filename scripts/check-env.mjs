const required = ["DATABASE_URL", "DIRECT_URL"];
const missing = required.filter((name) => !process.env[name] || !process.env[name].trim());

const line = "==============================================================";

function fail(title, lines) {
  console.error("");
  console.error(line);
  console.error(` ERROR DE CONFIGURACIÓN: ${title}`);
  console.error(line);
  for (const text of lines) console.error(text);
  console.error("");
  console.error(" El despliegue se detuvo para no publicar una app rota.");
  console.error(line);
  process.exit(1);
}

if (missing.length > 0) {
  fail("faltan variables de entorno", [
    ` Faltan: ${missing.join(", ")}`,
    "",
    " Qué hacer:",
    "  1. En Vercel abre tu proyecto → Settings → Environment Variables.",
    "  2. Agrega DATABASE_URL (Transaction pooler de Supabase, puerto 6543,",
    "     con ?pgbouncer=true) y DIRECT_URL (Session pooler, puerto 5432).",
    "  3. Marca Production (y Preview) y guarda.",
    "  4. Ve a Deployments → ⋯ → Redeploy.",
  ]);
}

let direct;
try {
  direct = new URL(process.env.DIRECT_URL.trim());
} catch {
  fail("DIRECT_URL no es una URL válida", [
    " Debe verse como: postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres",
    " Si la contraseña tiene caracteres especiales (@ # / :), codifícala (URL-encode).",
  ]);
}

const usesPgbouncerFlag = direct.searchParams.get("pgbouncer") === "true";
if (direct.port === "6543" || usesPgbouncerFlag) {
  fail("DIRECT_URL apunta al Transaction pooler (pgbouncer)", [
    ` DIRECT_URL usa ${direct.port === "6543" ? "el puerto 6543" : "pgbouncer=true"}.`,
    " Las migraciones de Prisma necesitan una conexión de sesión; con el Transaction",
    " pooler el comando `prisma migrate deploy` se queda colgado (advisory lock).",
    "",
    " Qué hacer:",
    "  1. En Supabase: Project Settings → Database → Connection string → Session pooler.",
    "  2. Copia esa URL (host *.pooler.supabase.com, puerto 5432, usuario postgres.PROJECT_REF).",
    "  3. En Vercel → Settings → Environment Variables reemplaza DIRECT_URL por esa URL",
    "     (sin ?pgbouncer=true). DATABASE_URL se queda con el puerto 6543.",
    "  4. Haz Redeploy.",
  ]);
}

if (/^db\.[^.]+\.supabase\.co$/.test(direct.hostname)) {
  console.warn(
    "[aviso] DIRECT_URL usa la conexión directa de Supabase (db.*.supabase.co), que solo " +
      "tiene IPv6 y puede fallar en Vercel. Si el build no conecta, usa el Session pooler " +
      "(host *.pooler.supabase.com, puerto 5432).",
  );
}
