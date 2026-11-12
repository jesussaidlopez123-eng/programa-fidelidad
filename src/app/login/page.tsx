import { redirect } from "next/navigation";
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-3xl border border-line bg-white p-8 shadow-sm">
        <header className="text-center">
          <p className="font-display text-3xl text-forest">Fidelidad</p>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-ink/50">Control de abonos</p>
        </header>
        <LoginForm />
      </div>
    </main>
  );
}
