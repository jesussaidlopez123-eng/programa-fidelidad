import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// El pooler de transacción de Supabase (puerto 6543) exige pgbouncer=true; sin él
// Prisma falla con "prepared statement already exists".
function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return undefined;
  const usesPooler = url.includes(":6543") || url.includes(".pooler.supabase.com");
  if (usesPooler && !/[?&]pgbouncer=/.test(url)) {
    return `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true`;
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
