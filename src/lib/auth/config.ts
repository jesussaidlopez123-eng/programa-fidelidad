export type Role = "SUCURSAL" | "ADMIN";

export const SESSION_COOKIE = "fidelidad_session";
export const SESSION_SECONDS = 60 * 60 * 12;

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/",
  SUCURSAL: "/alta",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  SUCURSAL: "Sucursal",
};

const SUCURSAL_PATHS = ["/alta", "/asistencia", "/print"];

export function isRole(value: unknown): value is Role {
  return value === "ADMIN" || value === "SUCURSAL";
}

export function canAccessPath(role: Role, pathname: string): boolean {
  if (role === "ADMIN") return true;
  return SUCURSAL_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function normalizeUserName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}
