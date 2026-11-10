"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 640,
          margin: "0 auto",
          padding: "4rem 1.5rem",
          lineHeight: 1.5,
        }}
      >
        <h1>La aplicación no pudo iniciar</h1>
        <p>
          No se pudo conectar a la base de datos. Revisa DATABASE_URL, DIRECT_URL y que se haya
          corrido prisma migrate deploy.
        </p>
        <p>
          Diagnóstico: <a href="/api/health">/api/health</a>
        </p>
        {error.digest ? <p style={{ fontSize: 12, color: "#666" }}>Código: {error.digest}</p> : null}
        <button type="button" onClick={() => reset()}>
          Reintentar
        </button>
      </body>
    </html>
  );
}
