"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeUserName } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/session";

type Result = { ok: true } | { ok: false; error: string };

const MIN_PASSWORD = 4;

function validateName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeUserName(raw);
  if (name.length < 2) return { ok: false, error: "El nombre debe tener al menos 2 caracteres." };
  if (name.length > 40) return { ok: false, error: "El nombre es demasiado largo (máximo 40)." };
  return { ok: true, name };
}

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  }
  if (password.length > 72) return "La contraseña es demasiado larga (máximo 72).";
  return null;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function listUsers() {
  await requireUser(["ADMIN"]);
  return prisma.user.findMany({
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, createdAt: true },
  });
}

export async function createUser(formData: FormData): Promise<Result> {
  await requireUser(["ADMIN"]);
  const checked = validateName(String(formData.get("name") ?? ""));
  if (!checked.ok) return checked;
  const password = String(formData.get("password") ?? "");
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };
  const role: UserRole = formData.get("role") === "ADMIN" ? "ADMIN" : "SUCURSAL";

  try {
    await prisma.user.create({
      data: { name: checked.name, role, passwordHash: await bcrypt.hash(password, 10) },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `Ya existe un usuario llamado ${checked.name}.` };
    }
    throw error;
  }
  revalidatePath("/usuarios");
  revalidatePath("/login");
  return { ok: true };
}

export async function updateUserName(id: string, rawName: string): Promise<Result> {
  await requireUser(["ADMIN"]);
  const checked = validateName(rawName);
  if (!checked.ok) return checked;

  try {
    await prisma.user.update({ where: { id }, data: { name: checked.name } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `Ya existe un usuario llamado ${checked.name}.` };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: "El usuario ya no existe." };
    }
    throw error;
  }
  revalidatePath("/usuarios");
  revalidatePath("/login");
  return { ok: true };
}

export async function changeUserPassword(id: string, password: string): Promise<Result> {
  await requireUser(["ADMIN"]);
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };

  try {
    await prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: "El usuario ya no existe." };
    }
    throw error;
  }
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function deleteUser(id: string): Promise<Result> {
  const current = await requireUser(["ADMIN"]);
  if (current.id === id) {
    return { ok: false, error: "No puedes eliminar tu propio usuario." };
  }

  return prisma.$transaction(async (tx): Promise<Result> => {
    const target = await tx.user.findUnique({ where: { id } });
    if (!target) return { ok: false, error: "El usuario ya no existe." };
    if (target.role === "ADMIN") {
      const admins = await tx.user.count({ where: { role: "ADMIN" } });
      if (admins <= 1) {
        return { ok: false, error: "No se puede eliminar al último administrador." };
      }
    }
    await tx.user.delete({ where: { id } });
    revalidatePath("/usuarios");
    revalidatePath("/login");
    return { ok: true };
  });
}
