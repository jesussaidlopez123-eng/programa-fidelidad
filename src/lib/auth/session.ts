import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLE_HOME, SESSION_COOKIE, SESSION_SECONDS, type Role } from "./config";
import { signSession, verifySession } from "./token";

export type SessionUser = { id: string; name: string; role: Role };

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;

  // El usuario se revalida en la base: si lo eliminaron o cambió de rol, la sesión deja de valer.
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, role: true },
  });
  return user;
});

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

export async function startSession(user: SessionUser) {
  const token = await signSession({ uid: user.id, role: user.role });
  const secure = headers().get("x-forwarded-proto") === "https";
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function endSession() {
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
