export type PunctualitySettings = {
  dueDayOfMonth: number;
  graceDays: number;
};

export type PunctualityResult = {
  isOnTime: boolean;
  dueDate: Date;
  deadline: Date;
  dueDayOfMonth: number;
  graceDays: number;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function evaluatePunctuality(
  now: Date,
  settings: PunctualitySettings,
): PunctualityResult {
  const dueDay = Math.min(
    Math.max(1, settings.dueDayOfMonth),
    daysInMonth(now.getFullYear(), now.getMonth()),
  );
  const dueDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), dueDay));
  const deadline = startOfDay(
    new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() + settings.graceDays),
  );
  const today = startOfDay(now);

  return {
    isOnTime: today.getTime() <= deadline.getTime(),
    dueDate,
    deadline,
    dueDayOfMonth: settings.dueDayOfMonth,
    graceDays: settings.graceDays,
  };
}

export function punctualityLabel(result: PunctualityResult) {
  const deadline = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(
    result.deadline,
  );
  if (result.isOnTime) {
    return `Puntual · vence el ${deadline}`;
  }
  return `Tardío · la fecha límite era el ${deadline}`;
}
