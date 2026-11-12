import { listUsers } from "@/app/actions/users";
import { UsersManager } from "@/components/users/users-manager";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const current = await requireUser(["ADMIN"]);
  const users = await listUsers();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-teal">Administración</p>
        <h1 className="font-display text-4xl">Usuarios</h1>
        <p className="mt-2 text-ink/65">
          Cada sucursal entra con su propio usuario. Las sucursales solo ven Alta y Recepción de
          abono; los administradores ven todo.
        </p>
      </header>
      <UsersManager
        currentUserId={current.id}
        users={users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }))}
      />
    </div>
  );
}
