"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ROLE_HOME, normalizeUserName, type Role } from "@/lib/auth/config";
import { endSession, startSession } from "@/lib/auth/session";

export type LoginUserOption = { name: string; role: Role };

/** Lista pública para el selector de login: solo nombre y rol (sin hashes). */
export async function listLoginUsers(): Promise<LoginUserOption[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: { name: true, role: true },
  });
  return users;
}

const INVALID = { ok: false as const, error: "Usuario o contraseña incorrectos." };
// Hash de relleno para que el tiempo de respuesta no revele si el usuario existe.
let dummyHash: string | null = null;
function getDummyHash() {
  dummyHash ??= bcrypt.hashSync("sin-usuario", 10);
  return dummyHash;
}

export async function login(formData: FormData) {
  const name = normalizeUserName(String(formData.get("name") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!name || !password) {
    return { ok: false as const, error: "Escribe tu usuario y contraseña." };
  }

  const user = await prisma.user.findUnique({ where: { name } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !valid) return INVALID;

  await startSession({ id: user.id, name: user.name, role: user.role });
  return { ok: true as const, home: ROLE_HOME[user.role] };
}

export async function logout() {
  endSession();
  redirect("/login");
}
