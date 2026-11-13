import { addBusinessCalendarDays, startOfBusinessDay } from "@/lib/business-time";

/**
 * Regla de puntualidad por ciclo desde el abono (CREDICEL).
 *
 * Convención de ventana (día del ancla = 0; plazo inclusive):
 * - El abono de referencia (primer abono o el que reinicia/continúa el ciclo) es el día 0.
 * - El siguiente abono debe llegar a más tardar al final del día
 *   `cycleDays + graceDays` contado desde ese ancla (por defecto 7 + 2 = 9).
 * - Ejemplo: abono el lunes 1 → puntual si el siguiente llega el miércoles 10 o antes.
 * - Sin abono previo en el crédito, el primer abono siempre es puntual y fija el ancla.
 * - Todo abono registrado (puntual o tardío) pasa a ser el nuevo ancla del siguiente ciclo.
 */
export type PunctualitySettings = {
  cycleDays: number;
  graceDays: number;
};

export type PunctualityResult = {
  isOnTime: boolean;
  /** Día en que vence el ciclo (sin gracia), a partir del ancla. */
  dueDate: Date;
  /** Último día puntual inclusive (ciclo + gracia). */
  deadline: Date;
  cycleDays: number;
  graceDays: number;
  /** false = primer abono del crédito (sin ancla previa). */
  hasAnchor: boolean;
};

export function evaluatePunctuality(
  now: Date,
  settings: PunctualitySettings,
  anchorPaymentDate: Date | null,
): PunctualityResult {
  const cycleDays = Math.max(1, settings.cycleDays);
  const graceDays = Math.max(0, settings.graceDays);
  const today = startOfBusinessDay(now);

  if (!anchorPaymentDate) {
    const dueDate = addBusinessCalendarDays(today, cycleDays);
    const deadline = addBusinessCalendarDays(today, cycleDays + graceDays);
    return {
      isOnTime: true,
      dueDate,
      deadline,
      cycleDays,
      graceDays,
      hasAnchor: false,
    };
  }

  const anchor = startOfBusinessDay(anchorPaymentDate);
  const dueDate = addBusinessCalendarDays(anchor, cycleDays);
  const deadline = addBusinessCalendarDays(anchor, cycleDays + graceDays);

  return {
    isOnTime: today.getTime() <= deadline.getTime(),
    dueDate,
    deadline,
    cycleDays,
    graceDays,
    hasAnchor: true,
  };
}

export function punctualityLabel(result: PunctualityResult) {
  const deadline = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(
    result.deadline,
  );
  if (!result.hasAnchor) {
    return `Primer abono · fija el ciclo de ${result.cycleDays}+${result.graceDays} días`;
  }
  if (result.isOnTime) {
    return `Puntual · tienes hasta el ${deadline}`;
  }
  return `Tardío · la fecha límite era el ${deadline}`;
}
