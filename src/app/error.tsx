"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-4 p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-muted">Algo salió mal</p>
      <h1 className="font-display text-3xl font-semibold">No se pudo cargar esta página</h1>
      <p className="text-ink/70">
        No se pudo conectar a la base de datos. Revisa <code>DATABASE_URL</code>,{" "}
        <code>DIRECT_URL</code> y que se haya corrido <code>prisma migrate deploy</code>.
      </p>
      <p className="text-sm text-muted">
        Para ver el diagnóstico exacto abre{" "}
        <a href="/api/health" className="font-semibold text-brand underline">
          /api/health
        </a>
        .
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted">Código de error: {error.digest}</p>
      ) : null}
      <div>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
