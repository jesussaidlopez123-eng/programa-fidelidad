# Fidelidad — Control de asistencia de abonos

Programa de fidelidad para una casa de crédito. Cada cliente con crédito activo recibe un código de barras (`CRD-000123`). Al registrar la **asistencia del abono** se marca puntual o tardío según el día de corte y los días de gracia. Cinco abonos puntuales desbloquean un premio.

Esta herramienta **no es una caja**: no cobra, no muestra totales recaudados ni actualiza un saldo en pantalla. Solo controla si el cliente cumplió su abono.

Rutas (todas requieren iniciar sesión):

| Ruta | Quién entra | Qué hace |
| --- | --- | --- |
| `/login` | Todos | Inicio de sesión (usuario + contraseña) |
| `/alta` | Sucursal y Administrador | Alta de cliente con crédito inicial y tarjeta imprimible (`/print/...`) |
| `/asistencia` | Sucursal y Administrador | **Recepción de abono** (lector USB + cámara) |
| `/` | Administrador | Dashboard (asistencias de hoy, regalos pendientes, clientes en racha 4/5) |
| `/customers` | Administrador | Directorio de clientes |
| `/rewards` | Administrador | **Regalos** pendientes / entregados |
| `/usuarios` | Administrador | Administrar usuarios |

## Usuarios y acceso

La primera vez que se despliega (y en cada build) el seed crea los usuarios que falten, **sin tocar contraseñas ni usuarios existentes** y sin importar si ya hay clientes:

| Usuario | Rol |
| --- | --- |
| `HUATABAMPO`, `HUATABAMPO 2`, `ALLENDE`, `MERCADO`, `MERCADO 2`, `ALAMOS` | Sucursal |
| `ADMINISTRADOR`, `ADMINISTRADOR 2` | Administrador |

**Contraseña temporal de todos: `0000`.** Entra como administrador y cámbiala en **Usuarios → Cambiar contraseña** para cada usuario.

- **Sucursal** solo ve **Alta** y **Recepción de abono**. **Administrador** ve además Dashboard, Clientes, Regalos y Usuarios.
- El nombre de usuario no distingue mayúsculas de minúsculas (se guarda en mayúsculas) y debe ser único.
- En **Usuarios** el administrador puede agregar, renombrar, cambiar contraseña y eliminar usuarios. No se puede eliminar al propio usuario ni al último administrador.
- Cada cliente guarda qué sucursal lo dio de alta y cada abono qué sucursal lo recibió (se ve en Clientes y en el Dashboard).
- La sesión es una cookie firmada `httpOnly` que dura 12 horas. **No necesitas variables nuevas**: la firma se deriva de `DATABASE_URL`/`DIRECT_URL`. Opcionalmente define `AUTH_SECRET` (mínimo 16 caracteres) en Vercel para usar tu propio secreto; cambiarlo (o cambiar las URLs de la base) cierra todas las sesiones.
- Las contraseñas se guardan con `bcryptjs`. Si olvidas la contraseña de todos los administradores, edita la tabla `User` en Supabase o borra un administrador y haz Redeploy para que el seed lo recree con `0000`.

En la demo, el cliente en racha 4 es **María Elena Vargas · `CRD-000123`**: el siguiente abono puntual desbloquea el premio (solo se crea si la base está vacía).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL

## 1. Variables de entorno

Copia `.env.example` a `.env` y completa las URLs. Prisma usa dos conexiones:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Runtime (pooler de transacción en Supabase, puerto **6543**, con `?pgbouncer=true`) |
| `DIRECT_URL` | Migraciones (**Session pooler** de Supabase, puerto **5432**; nunca el 6543 ni `pgbouncer=true`) |

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
4. Copia **Session pooler** (puerto 5432, host `*.pooler.supabase.com`) en `DIRECT_URL`, sin `?pgbouncer=true`.
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

## 3. Desplegar en Vercel (sin comandos locales)

El build de Vercel prepara la base de datos solo. No necesitas computadora ni terminal:

1. Sube este repositorio a GitHub (`programa-fidelidad`).
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa el repo (Framework: Next.js, comando de build `npm run build`).
3. En **Settings → Environment Variables** agrega solo estas dos variables (Production y Preview):
   - `DATABASE_URL`: *Transaction pooler* de Supabase (puerto 6543, con `?pgbouncer=true`).
   - `DIRECT_URL`: *Session pooler* de Supabase (host `*.pooler.supabase.com`, **puerto 5432**, sin `pgbouncer=true`). Se usa para las migraciones.
4. Haz **Deploy** (o **Deployments → ⋯ → Redeploy** si ya existía).

Durante el build, `npm run build` ejecuta en este orden:

1. Verifica que existan `DATABASE_URL` y `DIRECT_URL`. Si falta alguna, o si `DIRECT_URL` usa el puerto 6543 / `pgbouncer=true`, el build **falla con un mensaje en español** que explica qué corregir (así no se publica una app rota).
2. `prisma generate`.
3. `prisma migrate deploy` (con límite de 120 s): crea o actualiza las tablas usando `DIRECT_URL`. Es seguro repetirlo; no borra datos. Si se cuelga, se cancela y muestra un mensaje útil en vez de quedarse esperando.
4. Seed de demostración **solo si la base no tiene clientes**. Nunca duplica ni borra datos existentes, y si falla no rompe el build.
5. `next build`.

Para desarrollo local sin tocar la base: `npm run build:local`.

## Solución de problemas

**Todas las páginas muestran "Application error: a server-side exception has occurred" (Vercel).**
Casi siempre es la base de datos, no el código. No necesitas ejecutar comandos: las migraciones se aplican solas en cada despliegue.

1. En Vercel → **Settings → Environment Variables** confirma que existen `DATABASE_URL` y `DIRECT_URL`, y haz **Redeploy**. Si falta alguna, el build fallará con un mensaje en español que dice cuál.
2. Abre `https://TU-APP.vercel.app/api/health`. Responde `{"ok": true}` si todo está bien; si no, muestra el error (sin credenciales), los **nombres** de las variables que faltan y una sugerencia.
3. **No conecta** (`P1001`): en Supabase usa el *Transaction pooler* (puerto 6543, host `*.pooler.supabase.com`) en `DATABASE_URL` con `?pgbouncer=true`. La conexión directa (`db.xxxx.supabase.co:5432`) es solo IPv6 y suele fallar desde Vercel.
4. **El build se queda colgado o falla en `prisma migrate deploy`** (último log: `Datasource "db" ... pooler.supabase.com:6543`): `DIRECT_URL` está apuntando al puerto **6543** (Transaction pooler / pgbouncer), que no soporta el bloqueo (advisory lock) que usa Prisma Migrate. Solución: en Supabase → Project Settings → Database → Connection string → **Session pooler**, copia esa URL (host `*.pooler.supabase.com`, puerto **5432**, usuario `postgres.PROJECT_REF`, sin `?pgbouncer=true`) y ponla en `DIRECT_URL` en Vercel; `DATABASE_URL` se queda con el puerto 6543. Haz **Redeploy**. El build ahora detecta este error antes de migrar y cancela las migraciones si tardan más de 120 s.
5. **Contraseña incorrecta** (`P1000`): si tiene caracteres especiales (`@`, `#`, `/`), codifícala (URL-encode).
6. **Prisma Client no generado**: el build ya ejecuta `prisma generate`. Si cambiaste el comando de build en Vercel, déjalo en `npm run build`.

Para ver los logs en Vercel: Project → **Deployments** → el despliegue → **Build Logs** (errores de migración) o **Logs** (errores en ejecución), y busca el `Digest` que muestra el error.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en `127.0.0.1:3000` |
| `npm run build` | Verifica variables, `prisma generate`, `prisma migrate deploy`, seed si la base está vacía y `next build` (lo usa Vercel) |
| `npm run build:local` | `prisma generate` + `next build` (sin tocar la base) |
| `npm run db:setup` | `prisma migrate deploy` y seed (solo si no hay clientes) |

## Flujo de fidelidad

1. Escanea el `barcodeId` en `/asistencia`.
2. Un abono **puntual** suma +1 a la racha.
3. Al llegar a 5: modal **¡PREMIO DESBLOQUEADO!**, se crea un `Reward` y la racha vuelve a 0.
4. Un abono **tardío** no suma; eliges conservar la racha o reiniciarla a 0.
5. Puntual vs tardío se calcula con el día de corte y los días de gracia (editables en el Dashboard).
