# Fidelidad — Control de asistencia de abonos

Programa de fidelidad para una casa de crédito. Cada cliente con crédito activo recibe un código de barras (`CRD-000123`). Al registrar la **asistencia del abono** se marca puntual o tardío según el día de corte y los días de gracia. Cinco abonos puntuales desbloquean un premio.

Esta herramienta **no es una caja**: no cobra, no muestra totales recaudados ni actualiza un saldo en pantalla. Solo controla si el cliente cumplió su abono.

Rutas:

- `/` Dashboard (asistencias de hoy, premios pendientes, clientes en racha 4/5)
- `/asistencia` Control de asistencia (lector USB + cámara)
- `/customers` Alta de clientes y tarjeta imprimible
- `/rewards` Premios pendientes / entregados

Sin autenticación (uso interno). En la demo, el cliente en racha 4 es **María Elena Vargas · `CRD-000123`**: el siguiente abono puntual desbloquea el premio.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL

## 1. Variables de entorno

Copia `.env.example` a `.env` y completa las URLs. Prisma usa dos conexiones:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Runtime (pooler de transacción en Supabase, puerto **6543**, con `?pgbouncer=true`) |
| `DIRECT_URL` | Migraciones (conexión directa, puerto **5432**) |

Nunca subas `.env`. En Vercel las mismas variables se configuran en Project Settings → Environment Variables.

### Postgres local (desarrollo)

Con Docker (recomendado):

```bash
docker compose up -d
```

O con Postgres instalado en el sistema:

```bash
createdb fidelidad
```

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/fidelidad?schema=public"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:5432/fidelidad?schema=public"
```

### Proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto (región cercana, anota la contraseña de `postgres`).
2. Ve a **Project Settings → Database**.
3. Copia **Transaction pooler** (puerto 6543) en `DATABASE_URL` y añade `?pgbouncer=true`.
4. Copia **Direct connection** (puerto 5432) en `DIRECT_URL`.
5. Si la contraseña tiene caracteres especiales, URL-encódala.

Ejemplo (sustituye `PROJECT_REF`, `PASSWORD` y `REGION`):

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

## 2. Instalar, migrar y sembrar

```bash
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

El servidor local queda en `http://127.0.0.1:3000`.

`prisma migrate deploy` aplica las migraciones de `prisma/migrations` (usa `DIRECT_URL`). El seed crea 5 clientes de demostración; uno tiene `currentStreak: 4`.

## 3. Desplegar en Vercel

1. Sube este repositorio a GitHub (`programa-fidelidad`).
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa el repo.
3. Framework: Next.js. Comando de build: `npm run build`.
4. Añade `DATABASE_URL` y `DIRECT_URL` (las mismas de Supabase) en Production y Preview.
5. Despliega.
6. Desde tu máquina, con el `.env` apuntando a Supabase:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Opcional: en Vercel puedes cambiar el build a `npx prisma migrate deploy && npm run build` para aplicar migraciones en cada deploy. El seed **no** debe correr en cada build (borraría datos).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en `127.0.0.1:3000` |
| `npm run build` | `prisma generate` + `next build` |
| `npm run db:setup` | `prisma migrate deploy` y seed |

## Flujo de fidelidad

1. Escanea el `barcodeId` en `/asistencia`.
2. Un abono **puntual** suma +1 a la racha.
3. Al llegar a 5: modal **¡PREMIO DESBLOQUEADO!**, se crea un `Reward` y la racha vuelve a 0.
4. Un abono **tardío** no suma; eliges conservar la racha o reiniciarla a 0.
5. Puntual vs tardío se calcula con el día de corte y los días de gracia (editables en el Dashboard).
