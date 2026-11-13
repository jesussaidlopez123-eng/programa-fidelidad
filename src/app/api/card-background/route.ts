import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: {
      cardBackgroundData: true,
      cardBackgroundMimeType: true,
      updatedAt: true,
    },
  });

  if (!settings?.cardBackgroundData) {
    return new NextResponse("Sin fondo", { status: 404 });
  }

  const body = Buffer.from(settings.cardBackgroundData);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": settings.cardBackgroundMimeType || "image/jpeg",
      "Content-Length": String(body.length),
      "Cache-Control": "private, max-age=60",
      "Last-Modified": settings.updatedAt.toUTCString(),
    },
  });
}
