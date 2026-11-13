import ExcelJS from "exceljs";
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

const COLUMNS: { header: string; key: keyof RegistroExportRow | "createdAtText" | "lastPaymentText" | "installmentText"; width: number }[] = [
  { header: "Código", key: "barcodeId", width: 14 },
  { header: "Nombre", key: "fullName", width: 28 },
  { header: "Número", key: "phone", width: 14 },
  { header: "Plataforma", key: "platform", width: 12 },
  { header: "Modelo", key: "model", width: 18 },
  { header: "IMEI", key: "imei", width: 18 },
  { header: "TAG/CURP", key: "tagCurp", width: 18 },
  { header: "Monto de abono", key: "installmentText", width: 14 },
  { header: "Racha", key: "racha", width: 10 },
  { header: "Abonos totales", key: "abonosTotales", width: 14 },
  { header: "Sucursal de alta", key: "createdByName", width: 18 },
  { header: "Fecha de alta", key: "createdAtText", width: 20 },
  { header: "Último abono", key: "lastPaymentText", width: 20 },
  { header: "Estado crédito", key: "creditStatus", width: 14 },
  { header: "Regalos ganados", key: "rewardsWon", width: 14 },
  { header: "Regalos pendientes", key: "rewardsPending", width: 16 },
  { header: "Nombres de regalos", key: "rewardNames", width: 32 },
];

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

/** Genera y descarga `registro-clientes-YYYY-MM-DD.xlsx` con las filas dadas (ya filtradas o todas). */
export async function downloadRegistroExcel(rows: RegistroExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fidelidad CREDICEL";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Registro", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };

  for (const row of rows) {
    sheet.addRow({
      barcodeId: row.barcodeId,
      fullName: row.fullName,
      phone: row.phone ?? "",
      platform: row.platform ?? "",
      model: row.model ?? "",
      imei: row.imei ?? "",
      tagCurp: row.tagCurp ?? "",
      installmentText: row.installmentAmount != null ? formatMoney(row.installmentAmount) : "",
      racha: row.racha ?? "",
      abonosTotales: row.abonosTotales ?? "",
      createdByName: row.createdByName ?? "",
      createdAtText: formatDate(row.createdAt),
      lastPaymentText: row.lastPaymentAt ? formatDate(row.lastPaymentAt) : "",
      creditStatus: statusLabel(row.creditStatus),
      rewardsWon: row.rewardsWon,
      rewardsPending: row.rewardsPending,
      rewardNames: row.rewardNames,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
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
