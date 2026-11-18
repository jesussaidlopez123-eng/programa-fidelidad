/** Logo CREDICEL para siluetas de impresión (PNG con fondo transparente). */
export const CREDICEL_LOGO_SRC = "/credicel-logo-card.png";

/** Ancho del logo en mm sobre tarjeta ID-1 (~85.6 mm). Mantener pequeño. */
export const CREDICEL_LOGO_WIDTH_MM = 9;

/** Alto proporcional al asset 72×61. */
export const CREDICEL_LOGO_HEIGHT_MM =
  CREDICEL_LOGO_WIDTH_MM * (61 / 72);

/** Margen desde el borde superior/derecho de la tarjeta. */
export const CREDICEL_LOGO_MARGIN_MM = 2.4;

const LOGO_ALIAS = "credicel-logo";

/** Carga el PNG como data URL (navegador). */
export async function loadCredicelLogoDataUrl(): Promise<string | null> {
  if (typeof fetch === "undefined") return null;
  try {
    const res = await fetch(CREDICEL_LOGO_SRC, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo leer el logo CREDICEL."));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export { LOGO_ALIAS as CREDICEL_LOGO_PDF_ALIAS };
