import { formatDate, formatMoney } from "@/lib/utils";

export type RegistroExportRow = {
  barcodeId: string;
  fullName: string;
  phone: string | null;
  platform: string | null;
  model: string | null;
  imei: string | null;
  tagCurp: string | null;
  installmentAmount: number | null;
  /** Plazo del crédito en semanas (null = sin dato / clientes antiguos). */
  totalWeeks: number | null;
  /** Marcas actuales hacia el próximo regalo (currentStreak). */
  racha: number | null;
  /** Cantidad total de pagos/abonos registrados (no es la racha). */
  abonosTotales: number | null;
  createdByName: string | null;
  createdAt: Date | string;
  lastPaymentAt: Date | string | null;
  creditStatus: string | null;
  rewardsWon: number;
  rewardsPending: number;
  rewardNames: string;
};

const HEADERS = [
  "Código",
  "Nombre",
  "Número",
  "Plataforma",
  "Modelo",
  "IMEI",
  "TAG/CURP",
  "Monto de abono",
  "Semanas totales",
  "Racha",
  "Abonos totales",
  "Sucursal de alta",
  "Fecha de alta",
  "Último abono",
  "Estado crédito",
  "Regalos ganados",
  "Regalos pendientes",
  "Nombres de regalos",
] as const;

function statusLabel(status: string | null) {
  if (status === "ACTIVE") return "Activo";
  if (status === "COMPLETED") return "Completado";
  if (status === "DEFAULTED") return "Mora";
  return status ?? "";
}

function fileDateStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toSheetRow(row: RegistroExportRow): Record<(typeof HEADERS)[number], string | number> {
  return {
    Código: row.barcodeId,
    Nombre: row.fullName,
    Número: row.phone ?? "",
    Plataforma: row.platform ?? "",
    Modelo: row.model ?? "",
    IMEI: row.imei ?? "",
    "TAG/CURP": row.tagCurp ?? "",
    "Monto de abono": row.installmentAmount != null ? formatMoney(row.installmentAmount) : "",
    "Semanas totales": row.totalWeeks ?? "",
    Racha: row.racha ?? "",
    "Abonos totales": row.abonosTotales ?? "",
    "Sucursal de alta": row.createdByName ?? "",
    "Fecha de alta": formatDate(row.createdAt),
    "Último abono": row.lastPaymentAt ? formatDate(row.lastPaymentAt) : "",
    "Estado crédito": statusLabel(row.creditStatus),
    "Regalos ganados": row.rewardsWon,
    "Regalos pendientes": row.rewardsPending,
    "Nombres de regalos": row.rewardNames,
  };
}

/** Genera y descarga `registro-clientes-YYYY-MM-DD.xlsx` con las filas dadas (ya filtradas o todas). */
export async function downloadRegistroExcel(rows: RegistroExportRow[]) {
  // Import dinámico: evita arrastrar SheetJS al bundle inicial / SSR.
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(rows.map(toSheetRow), { header: [...HEADERS] });
  sheet["!cols"] = HEADERS.map((header) => ({
    wch: Math.max(12, Math.min(36, header.length + 4)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Registro");

  const raw = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as number[];
  const blob = new Blob([new Uint8Array(raw)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `registro-clientes-${fileDateStamp()}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
