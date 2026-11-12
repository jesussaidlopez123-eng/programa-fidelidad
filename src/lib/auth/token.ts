import { SignJWT, jwtVerify } from "jose";
import { SESSION_SECONDS, isRole, type Role } from "./config";

export type SessionPayload = { uid: string; role: Role };

let keyPromise: Promise<Uint8Array> | null = null;

// Usa AUTH_SECRET si existe; si no, deriva el secreto de las URLs de la base de datos
// para no exigir una variable de entorno nueva.
async function deriveKey(): Promise<Uint8Array> {
  const explicit = process.env.AUTH_SECRET?.trim();
  const material =
    explicit && explicit.length >= 16
      ? `secret:${explicit}`
      : `derived:${process.env.DATABASE_URL ?? ""}|${process.env.DIRECT_URL ?? ""}`;
  if (!explicit && !process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    throw new Error("No hay AUTH_SECRET, DATABASE_URL ni DIRECT_URL para firmar sesiones.");
  }
  const data = new TextEncoder().encode(`fidelidad-auth-v1|${material}`);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

function getKey() {
  keyPromise ??= deriveKey();
  return keyPromise;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.uid)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(await getKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getKey(), { algorithms: ["HS256"] });
    if (!payload.sub || !isRole(payload.role)) return null;
    return { uid: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}
