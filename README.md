# Fidelidad — Control de asistencia de abonos

Programa de fidelidad para una casa de crédito. Cada cliente tiene una tarjeta con código de barras (el que se escanea al darlo de alta, por ejemplo `CRD-000123`). Al registrar la **asistencia del abono** se marca puntual o tardío según el **ciclo desde el último abono** (días del ciclo + días de gracia; por defecto 7+2). Los **regalos** se configuran por número de marcas puntuales (por defecto Regalo 1 = 5, Regalo 2 = 10, Regalo 3 = 15).

Esta herramienta **no es una caja**: no cobra, no muestra totales recaudados ni actualiza un saldo en pantalla. Solo controla si el cliente cumplió su abono.

Rutas (todas requieren iniciar sesión):

| Ruta | Quién entra | Qué hace |
| --- | --- | --- |
| `/login` | Todos | Inicio de sesión (usuario + contraseña) |
| `/alta` | Sucursal y Administrador | Alta de cliente: escanear tarjeta nueva y capturar datos |
| `/asistencia` | Sucursal y Administrador | **Recepción de abono** (lector USB + cámara) |
| `/evidencias` | Sucursal y Administrador | Premios del día pendientes de foto |
| `/` | Administrador | Dashboard (asistencias de hoy, regalos pendientes, rachas) |
| `/customers` | Administrador | **Registro** (antes Clientes): tabla, ficha y exportación Excel |
| `/rewards` | Administrador | **Regalos**: configuración de premios + premios ganados |
| `/usuarios` | Administrador | Administrar usuarios |

## Usuarios y acceso

La primera vez que se despliega (y en cada build) el seed crea los usuarios que falten, **sin tocar contraseñas ni usuarios existentes** y sin importar si ya hay clientes:

| Usuario | Rol |
| --- | --- |
| `HUATABAMPO`, `HUATABAMPO 2`, `ALLENDE`, `MERCADO`, `MERCADO 2`, `ALAMOS` | Sucursal |
| `ADMINISTRADOR`, `ADMINISTRADOR 2` | Administrador |

**Contraseña temporal de todos: `0000`.** Entra como administrador y cámbiala en **Usuarios → Cambiar contraseña** para cada usuario.

- **Sucursal** ve **Alta**, **Recepción de abono** y **Evidencias**. **Administrador** ve además Dashboard, Registro, Regalos y Usuarios.
- El nombre de usuario no distingue mayúsculas de minúsculas (se guarda en mayúsculas) y debe ser único.
- En **Usuarios** el administrador puede agregar, renombrar, cambiar contraseña y eliminar usuarios. No se puede eliminar al propio usuario ni al último administrador.
- Cada cliente guarda qué sucursal lo dio de alta y cada abono qué sucursal lo recibió (se ve en Registro y en el Dashboard).
- La sesión es una cookie firmada `httpOnly` que dura 12 horas. **No necesitas variables nuevas**: la firma se deriva de `DATABASE_URL`/`DIRECT_URL`. Opcionalmente define `AUTH_SECRET` (mínimo 16 caracteres) en Vercel para usar tu propio secreto; cambiarlo (o cambiar las URLs de la base) cierra todas las sesiones.
- Las contraseñas se guardan con `bcryptjs`. Si olvidas la contraseña de todos los administradores, edita la tabla `User` en Supabase o borra un administrador y haz Redeploy para que el seed lo recree con `0000`.

En la demo, el cliente en racha 4 es **María Elena Vargas · `CRD-000123`**: el siguiente abono puntual desbloquea el Regalo 1 (solo se crea si la base está vacía).

## Regalos (administrador)

En `/rewards` hay una tabla editable:

| Columna | Significado |
| --- | --- |
| **Regalo** | Regalo 1, 2 y 3 |
| **Nombre / descripción** | Texto del premio que se muestra al ganar |
| **Número de marcas necesarias** | Enteros crecientes (por defecto 5, 10, 15). **Vacío = desactivado** |

La configuración vive en la tabla `GiftTier` (seed idempotente). La migración convierte la regla anterior (`AppSettings.rewardEvery = 5`) en **Regalo 1 = 5**.

Debajo, la tabla de **premios ganados** muestra miniatura de la foto (si hay) y el estado entregado/pendiente.

## Recepción de abono (`/asistencia`)

1. Escanea el código de la tarjeta (lector USB + Enter, o botón de cámara). Si el código no existe se muestra un mensaje claro y no se abre ventana.
2. Se abre una ventana con toda la ficha del cliente: código, nombre, número, plataforma, modelo, IMEI, TAG/CURP, monto de abono, racha actual, número de abono y último abono (fecha y sucursal).
3. **Marcar pago** pide confirmación ("¿Confirmar pago de NOMBRE?"). Al confirmar se registra el abono:
   - Abono **puntual**: la racha suma +1. Si la racha alcanza exactamente las marcas de un regalo activo, se crea un `Reward` y aparece el modal grande **¡EL CLIENTE GANÓ!** con el nombre del cliente y el regalo.
   - Tras el regalo con **mayor** número de marcas, la racha vuelve a **0**. Los regalos intermedios no reinician la racha.
   - Abono **tardío**: no suma; eliges conservar la racha o reiniciarla a 0.
4. En el modal del premio puedes **subir foto** (archivo o cámara con `capture`), ver vista previa, **Subir foto** o **Subir después**. La imagen se comprime en el navegador (JPEG ~1000 px, ~300 KB) y se guarda en Postgres (`bytea`). No hace falta disco en Vercel ni variables de entorno nuevas. La ruta `/api/rewards/[id]/photo` sirve la imagen solo con sesión.
5. **Cancelar** y la tecla **Esc** cierran la ventana sin registrar nada.

**Evitar duplicados:** el botón se deshabilita mientras se guarda (el doble clic registra un solo abono; el servidor además bloquea el crédito durante el registro). Si el cliente ya tiene un abono registrado **hoy**, la ventana muestra una advertencia y se exige confirmación extra. "Hoy" se calcula en la zona horaria del negocio, por defecto `America/Hermosillo`; se puede cambiar con la variable opcional `BUSINESS_TIMEZONE`.

## Evidencias (`/evidencias`)

Módulo en el menú de **Sucursal** y **Administrador** (no es un ícono suelto en el header). Cada premio ganado **hoy** que aún no tiene foto aparece como tarjeta (cliente, regalo, hora, sucursal). El operador carga la foto; al subirla, la tarjeta desaparece y la imagen queda en la ficha del cliente en **Registro**.

## Registro (administrador)

Menú **Registro** (ruta `/customers`, solo ADMIN). Tabla con código, nombre, número, plataforma, modelo, IMEI, TAG/CURP, monto de abono, **Semanas totales** (plazo del crédito; "—" si no hay), **Racha** y **Abonos totales** (columnas separadas) y la sucursal que dio de alta al cliente. El buscador filtra por cualquiera de esos campos.

**Exportar Excel**: botón junto al buscador. Descarga `registro-clientes-YYYY-MM-DD.xlsx` (SheetJS/`xlsx`) con lo **visible**: si hay búsqueda, solo los filtrados; si no, todo el registro. Columnas: Código, Nombre, Número, Plataforma, Modelo, IMEI, TAG/CURP, Monto de abono, **Semanas totales** (`Credit.totalWeeks`; vacío si no hay), **Racha** (`currentStreak`), **Abonos totales** (cantidad de pagos registrados), Sucursal de alta, Fecha de alta, Último abono, Estado crédito, Regalos ganados / pendientes y nombres.

**Ficha del cliente** (`/customers/[id]`): datos (incluye **Semanas totales** si hay), galería de fotos de premios e historial de regalos con fecha.

**Eliminar cliente**: pide la contraseña del administrador en sesión (se verifica en el servidor con bcrypt). El diálogo indica cuántos créditos, abonos y regalos se eliminarán; es permanente.

## Alta de clientes

1. **Escanear tarjeta nueva**: el campo grande tiene foco automático para el lector USB y hay un botón para escanear con la cámara. El código escaneado se guarda como el código de barras del cliente. Debe ser único. Como respaldo hay un enlace "generar código automático" (`CRD-000123`).
2. **Datos del cliente**: Nombre, Número (teléfono), Plataforma (`PAYJOY` / `KREDIYA`), Modelo, IMEI, TAG/CURP, Monto de abono y **Semanas totales** (plazo del crédito, entero positivo). Todos son obligatorios. Si el IMEI no tiene 15 dígitos se avisa y se pide confirmar.
3. Al guardar se crea el cliente y su crédito (monto de abono + `totalWeeks`; `totalInstallments` sigue en 0) y la pantalla vuelve al escáner.

Las altas nuevas no cierran el crédito por número de abonos (`totalInstallments = 0`); **Semanas totales** es solo el plazo informado. En **Recepción de abono** se sigue contando racha, abonos y regalos.

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

## 2. Instalar, migrar y sembrar

```bash
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

El servidor local queda en `http://127.0.0.1:3000`.

`prisma migrate deploy` aplica las migraciones de `prisma/migrations` (usa `DIRECT_URL`). Es seguro repetirlo; no borra datos. El seed crea usuarios iniciales, los tres `GiftTier` y, si la base no tiene clientes, 5 clientes de demostración (uno con `currentStreak: 4`).

## 3. Desplegar en Vercel (sin comandos locales)

El build de Vercel prepara la base de datos solo. No necesitas computadora ni terminal:

1. Sube este repositorio a GitHub (`programa-fidelidad`).
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa el repo (Framework: Next.js, comando de build `npm run build`).
3. En **Settings → Environment Variables** agrega solo estas dos variables (Production y Preview):
   - `DATABASE_URL`: *Transaction pooler* de Supabase (puerto 6543, con `?pgbouncer=true`).
   - `DIRECT_URL`: *Session pooler* de Supabase (host `*.pooler.supabase.com`, **puerto 5432**, sin `pgbouncer=true`).
4. Haz **Deploy** (o **Deployments → ⋯ → Redeploy** si ya existía).

Durante el build, `npm run build` ejecuta en este orden:

1. Verifica que existan `DATABASE_URL` y `DIRECT_URL`. Si falta alguna, o si `DIRECT_URL` usa el puerto 6543 / `pgbouncer=true`, el build **falla con un mensaje en español**.
2. `prisma generate`.
3. `prisma migrate deploy` (con límite de 120 s): crea o actualiza las tablas usando `DIRECT_URL`. Es seguro repetirlo; no borra datos.
4. Seed **idempotente** (usuarios y GiftTier; clientes demo solo si la base está vacía). Si falla no rompe el build.
5. `next build`.

Para desarrollo local sin tocar la base: `npm run build:local`.

## Pruebas E2E (Playwright + Postgres local)

Con la base local migrada y sembrada, y un build listo:

```bash
docker compose up -d   # o Postgres local en 5432
cp .env.example .env   # ajusta a 127.0.0.1:5432/fidelidad
npx prisma migrate deploy && npx prisma db seed
npm run build:local
npm run test:e2e
```

Los tests en `e2e/` arrancan `npm run start`, inician sesión contra Postgres local, configuran regalos, registran un abono que desbloquea premio, suben foto desde Evidencias y comprueban la ficha del cliente.

## Solución de problemas

**Todas las páginas muestran "Application error: a server-side exception has occurred" (Vercel).**
Casi siempre es la base de datos, no el código. Las migraciones se aplican solas en cada despliegue.

1. En Vercel → **Settings → Environment Variables** confirma `DATABASE_URL` y `DIRECT_URL`, y haz **Redeploy**.
2. Abre `https://TU-APP.vercel.app/api/health`. Responde `{"ok": true}` si todo está bien.
3. **No conecta** (`P1001`): usa el *Transaction pooler* (puerto 6543) en `DATABASE_URL` con `?pgbouncer=true`.
4. **El build se queda colgado en `prisma migrate deploy`**: `DIRECT_URL` debe ser Session pooler puerto **5432**, sin `pgbouncer=true`.
5. **Contraseña incorrecta** (`P1000`): URL-encode caracteres especiales.
6. **Prisma Client no generado**: el build ya ejecuta `prisma generate`.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en `127.0.0.1:3000` |
| `npm run build` | Verifica variables, `prisma generate`, `prisma migrate deploy`, seed y `next build` (lo usa Vercel) |
| `npm run build:local` | `prisma generate` + `next build` (sin tocar la base) |
| `npm run db:setup` | `prisma migrate deploy` y seed |
| `npm run test:e2e` | Playwright contra la app en `127.0.0.1:3000` y Postgres local |

## Flujo de fidelidad

1. Escanea el `barcodeId` en `/asistencia`.
2. Un abono **puntual** suma +1 a la racha.
3. Al alcanzar las marcas de un regalo activo: modal **¡EL CLIENTE GANÓ!**, se crea un `Reward` y puedes subir la foto o dejarla para **Evidencias**.
4. Tras el regalo con más marcas, la racha vuelve a 0.
5. Un abono **tardío** no suma; eliges conservar la racha o reiniciarla a 0.
6. Puntual vs tardío: desde cada abono el cliente tiene **días del ciclo + días de gracia** (editables en el Dashboard; default 7+2). Si abona a tiempo, la racha suma y esa fecha es el nuevo ancla; si se pasa, es tardío (conservar o reiniciar racha) y el siguiente abono vuelve a fijar el ancla. El primer abono de un crédito siempre es puntual. Los regalos se editan en `/rewards`.
