/** Diseños predefinidos para siluetas de impresión de tarjetas CREDICEL. */

export const CUSTOM_CARD_DESIGN_ID = "custom" as const;

export type CardDesignPresetId = "azul" | "blanco-azul" | "midnight" | "verde";

export type CardDesignId = CardDesignPresetId | typeof CUSTOM_CARD_DESIGN_ID;

export type CardDesignPreset = {
  id: CardDesignPresetId;
  label: string;
  description: string;
  /** Fondo CSS de la miniatura. */
  cssBackground: string;
  /** Color del texto CREDICEL en miniatura / canvas. */
  textColor: string;
  /** Color de acento (franja inferior). */
  accentColor: string;
  /** Colores del degradado en canvas (start → end). */
  gradient: [string, string];
};

export const CARD_DESIGN_PRESETS: CardDesignPreset[] = [
  {
    id: "azul",
    label: "Azul CREDICEL",
    description: "Gradiente azul marca",
    cssBackground: "linear-gradient(145deg, #0045A5 0%, #003785 55%, #002a66 100%)",
    textColor: "#FFFFFF",
    accentColor: "#7EB6FF",
    gradient: ["#0045A5", "#002a66"],
  },
  {
    id: "blanco-azul",
    label: "Blanco / Azul",
    description: "Fondo claro con marca",
    cssBackground: "linear-gradient(160deg, #FFFFFF 0%, #F0F5FC 45%, #D6E4F7 100%)",
    textColor: "#0045A5",
    accentColor: "#0045A5",
    gradient: ["#FFFFFF", "#D6E4F7"],
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Oscuro con acento azul",
    cssBackground: "linear-gradient(145deg, #0B1120 0%, #1A2344 60%, #243056 100%)",
    textColor: "#E8F0FF",
    accentColor: "#0045A5",
    gradient: ["#0B1120", "#243056"],
  },
  {
    id: "verde",
    label: "Verde suave",
    description: "Toque fresco + marca",
    cssBackground: "linear-gradient(145deg, #E8F5EE 0%, #D4EBDD 50%, #BFE0CD 100%)",
    textColor: "#0045A5",
    accentColor: "#1B7A4E",
    gradient: ["#E8F5EE", "#BFE0CD"],
  },
];

export function isCardDesignPresetId(value: string | null | undefined): value is CardDesignPresetId {
  return CARD_DESIGN_PRESETS.some((preset) => preset.id === value);
}

export function getCardDesignPreset(id: CardDesignPresetId): CardDesignPreset {
  const preset = CARD_DESIGN_PRESETS.find((item) => item.id === id);
  if (!preset) throw new Error(`Diseño desconocido: ${id}`);
  return preset;
}

const CANVAS_W = 856;
const CANVAS_H = 540;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Renderiza un diseño predefinido a data URL JPEG (navegador).
 * Aspecto ID-1 (~85.6×54 mm). Incluye texto CREDICEL; el PNG va en el PDF.
 */
export async function renderCardDesignDataUrl(
  designId: CardDesignPresetId,
): Promise<{ dataUrl: string; blob: Blob; mimeType: "image/jpeg" }> {
  const preset = getCardDesignPreset(designId);
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no soporta canvas.");

  const start = hexToRgb(preset.gradient[0]);
  const end = hexToRgb(preset.gradient[1]);
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  gradient.addColorStop(0, `rgb(${start.r},${start.g},${start.b})`);
  gradient.addColorStop(1, `rgb(${end.r},${end.g},${end.b})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Franja de acento inferior
  const accent = hexToRgb(preset.accentColor);
  ctx.fillStyle = `rgba(${accent.r},${accent.g},${accent.b},0.92)`;
  ctx.fillRect(0, CANVAS_H - 36, CANVAS_W, 36);

  // Marca CREDICEL (esquina superior izquierda). El logo PNG va arriba-derecha en el PDF.
  ctx.fillStyle = preset.textColor;
  ctx.font = "700 54px Arial, Helvetica, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("CREDICEL", 48, 40);

  // Diseño 1 (azul): sin la palabra "fidelidad".
  const subtitle = designId === "azul" ? "Programa" : "Programa de fidelidad";
  ctx.font = "500 22px Arial, Helvetica, sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText(subtitle, 50, 108);
  ctx.globalAlpha = 1;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error("No se pudo generar el diseño."));
        else resolve(result);
      },
      "image/jpeg",
      0.9,
    );
  });

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo preparar el diseño."));
    reader.readAsDataURL(blob);
  });

  return { dataUrl, blob, mimeType: "image/jpeg" };
}
