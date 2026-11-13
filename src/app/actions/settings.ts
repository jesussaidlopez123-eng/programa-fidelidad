"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { loadSettings } from "@/lib/settings";

export async function getSettings() {
  await requireUser();
  return loadSettings();
}

export async function updateSettings(formData: FormData) {
  await requireUser(["ADMIN"]);
  const cycleDays = clampInt(formData.get("cycleDays"), 1, 60, 7);
  const graceDays = clampInt(formData.get("graceDays"), 0, 30, 2);

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: { cycleDays, graceDays },
    create: {
      id: "default",
      cycleDays,
      graceDays,
      rewardEvery: 5,
      rewardName: "Regalo 1",
    },
  });

  revalidatePath("/");
  revalidatePath("/asistencia");
}

function clampInt(value: FormDataEntryValue | null, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
