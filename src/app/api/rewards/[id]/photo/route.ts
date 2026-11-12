import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const reward = await prisma.reward.findUnique({
    where: { id: params.id },
    select: {
      photoData: true,
      photoMimeType: true,
      photoUploadedAt: true,
    },
  });

  if (!reward?.photoData) {
    return new NextResponse("Sin foto", { status: 404 });
  }

  const body = Buffer.from(reward.photoData);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": reward.photoMimeType || "image/jpeg",
      "Content-Length": String(body.length),
      "Cache-Control": "private, max-age=3600",
      ...(reward.photoUploadedAt
        ? { "Last-Modified": reward.photoUploadedAt.toUTCString() }
        : {}),
    },
  });
}
