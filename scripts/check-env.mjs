const required = ["DATABASE_URL", "DIRECT_URL"];
const missing = required.filter((name) => !process.env[name] || !process.env[name].trim());

if (missing.length > 0) {
  console.error("");
  console.error("==============================================================");
  console.error(" ERROR DE CONFIGURACIÓN: faltan variables de entorno");
  console.error("==============================================================");
  console.error(` Faltan: ${missing.join(", ")}`);
  console.error("");
  console.error(" Qué hacer:");
  console.error("  1. En Vercel abre tu proyecto → Settings → Environment Variables.");
  console.error("  2. Agrega DATABASE_URL (Transaction pooler de Supabase, puerto 6543,");
  console.error("     con ?pgbouncer=true) y DIRECT_URL (Direct connection, puerto 5432).");
  console.error("  3. Marca Production (y Preview) y guarda.");
  console.error("  4. Ve a Deployments → ⋯ → Redeploy.");
  console.error("");
  console.error(" El despliegue se detuvo para no publicar una app rota.");
  console.error("==============================================================");
  process.exit(1);
}
