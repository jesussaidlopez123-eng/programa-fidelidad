export const REQUIRED_ENV_VARS = ["DATABASE_URL", "DIRECT_URL"] as const;

export function getMissingEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter((name) => !process.env[name]?.trim());
}

const SECRET_ENV_NAMES = ["DATABASE_URL", "DIRECT_URL"];

export function sanitizeErrorMessage(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);

  message = message.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'`)]+/gi, "[url oculta]");

  for (const name of SECRET_ENV_NAMES) {
    const value = process.env[name];
    if (value && value.length > 6) {
      message = message.split(value).join("[oculto]");
    }
  }

  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const meaningful = lines.filter((line) => !line.startsWith("Invalid `prisma"));
  return (meaningful.length ? meaningful : lines).join(" ").slice(0, 400);
}

export function errorCode(error: unknown): string | null {
  if (error && typeof error === "object") {
    const { code, errorCode: initCode } = error as { code?: unknown; errorCode?: unknown };
    if (typeof code === "string") return code;
    if (typeof initCode === "string") return initCode;
  }
  return null;
}

export function diagnoseDbError(error: unknown, missingEnv: string[]): string {
  if (missingEnv.includes("DATABASE_URL")) {
    return "Falta DATABASE_URL en las variables de entorno de Vercel (Settings → Environment Variables). Después haz Redeploy.";
  }
  const message = error instanceof Error ? error.message : "";
  let code = errorCode(error);
  if (!code) {
    const match = message.match(/\bP\d{4}\b/);
    if (match) code = match[0];
    else if (/Can't reach database server/i.test(message)) code = "P1001";
    else if (/Authentication failed/i.test(message)) code = "P1000";
  }
  if (code === "P2021" || code === "P2022" || /does not exist/i.test(message)) {
    return "La base de datos responde pero faltan tablas. Corre `npx prisma migrate deploy` (y `npx prisma db seed` la primera vez) desde tu máquina apuntando a la base de producción.";
  }
  if (code === "P1000") {
    return "Usuario o contraseña incorrectos en DATABASE_URL. Si la contraseña tiene caracteres especiales, codifícala (URL-encode).";
  }
  if (code === "P1001" || code === "P1002") {
    return "No se alcanza el servidor de base de datos. En Supabase usa el Transaction pooler (puerto 6543, host *.pooler.supabase.com) en DATABASE_URL: la conexión directa (db.*.supabase.co) suele no funcionar desde Vercel.";
  }
  if (code === "P1017" || /prepared statement/i.test(message)) {
    return "Problema con el pooler de conexiones. Añade `?pgbouncer=true` al final de DATABASE_URL si usas el puerto 6543.";
  }
  if (/Environment variable not found/i.test(message)) {
    return "Falta una variable de entorno requerida por Prisma. Revisa DATABASE_URL y DIRECT_URL en Vercel.";
  }
  if (/Prisma Client|did not initialize|@prisma\/client/i.test(message)) {
    return "Prisma Client no está generado. Verifica que el build de Vercel ejecute `prisma generate` (script `postinstall`/`build`).";
  }
  const extra = missingEnv.length > 0 ? ` Variables faltantes: ${missingEnv.join(", ")}.` : "";
  return "No se pudo consultar la base de datos. Revisa DATABASE_URL, DIRECT_URL y que se haya corrido `prisma migrate deploy`." + extra;
}
