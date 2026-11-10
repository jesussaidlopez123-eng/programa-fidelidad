import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diagnoseDbError, errorCode, getMissingEnvVars, sanitizeErrorMessage } from "@/lib/env-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const missingEnv = getMissingEnvVars();
  const headers = { "Cache-Control": "no-store" };

  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.appSettings.count();

    return NextResponse.json(
      { ok: true, database: "connected", missingEnv, checkedAt: new Date().toISOString() },
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        missingEnv,
        code: errorCode(error) ?? sanitizeErrorMessage(error).match(/\bP\d{4}\b/)?.[0] ?? null,
        error: sanitizeErrorMessage(error),
        hint: diagnoseDbError(error, missingEnv),
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers },
    );
  }
}
