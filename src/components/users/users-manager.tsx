"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  updateUserName,
} from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UserRow = { id: string; name: string; role: "SUCURSAL" | "ADMIN"; createdAt: string };
type Mode = "name" | "password" | null;

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; mode: Mode } | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, okMessage: string) {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      toast.success(okMessage);
      router.refresh();
      return true;
    } catch {
      toast.error("No se pudo completar la acción. Intenta de nuevo.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startEdit(user: UserRow, mode: Mode) {
    setEditing({ id: user.id, mode });
    setValue(mode === "name" ? user.name : "");
  }

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_auto_auto]"
        action={async (formData) => {
          setAdding(true);
          const ok = await run(() => createUser(formData), "Usuario agregado");
          setAdding(false);
          if (ok) (document.getElementById("new-user-form") as HTMLFormElement | null)?.reset();
        }}
        id="new-user-form"
      >
        <h2 className="font-display text-2xl md:col-span-4">Agregar usuario</h2>
        <div className="space-y-1.5">
          <Label htmlFor="new-name">Nombre de usuario</Label>
          <Input id="new-name" name="name" required placeholder="Ej. MERCADO 3" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Contraseña</Label>
          <Input id="new-password" name="password" type="text" required minLength={4} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-role">Rol</Label>
          <select
            id="new-role"
            name="role"
            defaultValue="SUCURSAL"
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm"
          >
            <option value="SUCURSAL">Sucursal</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={adding || busy}>
            {adding ? "Agregando…" : "Agregar"}
          </Button>
        </div>
      </form>

      <ul className="space-y-3">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          const isEditing = editing?.id === user.id ? editing.mode : null;
          return (
            <li key={user.id} className="rounded-3xl border border-line bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{user.name}</span>
                  <Badge tone={user.role === "ADMIN" ? "gold" : "teal"}>
                    {user.role === "ADMIN" ? "Administrador" : "Sucursal"}
                  </Badge>
                  {isSelf ? <Badge tone="slate">Tú</Badge> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(user, "name")}>
                    Editar nombre
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => startEdit(user, "password")}>
                    Cambiar contraseña
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSelf || busy}
                    title={isSelf ? "No puedes eliminar tu propio usuario" : undefined}
                    onClick={async () => {
                      if (!window.confirm(`¿Eliminar al usuario ${user.name}? Esta acción no se puede deshacer.`)) return;
                      await run(() => deleteUser(user.id), "Usuario eliminado");
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>

              {isEditing ? (
                <form
                  className="mt-4 flex flex-wrap items-end gap-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const ok = await run(
                      () =>
                        isEditing === "name"
                          ? updateUserName(user.id, value)
                          : changeUserPassword(user.id, value),
                      isEditing === "name" ? "Nombre actualizado" : "Contraseña actualizada",
                    );
                    if (ok) {
                      setEditing(null);
                      setValue("");
                    }
                  }}
                >
                  <div className="min-w-[220px] flex-1 space-y-1.5">
                    <Label htmlFor={`edit-${user.id}`}>
                      {isEditing === "name" ? "Nuevo nombre" : "Nueva contraseña"}
                    </Label>
                    <Input
                      id={`edit-${user.id}`}
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      type="text"
                      autoComplete="off"
                      required
                      autoFocus
                    />
                  </div>
                  <Button type="submit" disabled={busy}>
                    Guardar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
