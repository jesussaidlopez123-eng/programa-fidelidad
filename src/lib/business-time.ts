// Zona horaria del negocio para decidir qué cuenta como "hoy" (por defecto Sonora, sin horario de verano).
const BUSINESS_TZ = process.env.BUSINESS_TIMEZONE || "America/Hermosillo";

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function startOfBusinessDay(now = new Date()): Date {
  let timeZone = BUSINESS_TZ;
  try {
    zoneParts(now, timeZone);
  } catch {
    timeZone = "America/Hermosillo";
  }
  const p = zoneParts(now, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offsetMs = asUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - offsetMs);
}
