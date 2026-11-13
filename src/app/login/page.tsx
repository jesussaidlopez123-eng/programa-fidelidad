import { redirect } from "next/navigation";
import { listLoginUsers } from "@/app/actions/auth";
import { LoginForm } from "@/components/login-form";
import { ROLE_HOME } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Iniciar sesión · Fidelidad" };

export default async function LoginPage() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  if (user) redirect(ROLE_HOME[user.role]);

  const users = await listLoginUsers();

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-line bg-white p-8 shadow-sm">
        <header className="text-center">
          <p className="font-display text-3xl font-semibold text-brand">Fidelidad</p>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted">Control de abonos</p>
        </header>
        <LoginForm users={users} />
      </div>
    </main>
  );
}
