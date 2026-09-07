import * as XLSX from "xlsx";
import type { JobItem, PORecord, PlanRow, ScheduleResult } from "../types";

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeHeader(value: unknown): string {
  return toText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "");
}

const HEADER_ALIASES: Record<string, keyof PORecord | "frontDm" | "backDm" | "itemCode"> = {
  po: "po",
  mahang: "itemCode",
  manguoi: "itemCode",
  code: "itemCode",
  mamahang: "itemCode",
  mahanghoa: "itemCode",
  mauvai: "color",
  mau: "color",
  soluong: "quantity",
  sl: "quantity",
  front: "frontDm",
  back: "backDm",
  dmtruoc: "frontDm",
  dmsau: "backDm",
};

export function parseExcelRecords(file: File): Promise<PORecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được file Excel."));
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve([]);
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (!rawRows.length) {
          resolve([]);
          return;
        }

        const headers = Object.keys(rawRows[0]).map((key) => ({ raw: key, norm: normalizeHeader(key) }));

        const records = rawRows
          .map((row, index) => {
            const normalizedRow: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(row)) {
              normalizedRow[normalizeHeader(key)] = value;
            }

            const record: Partial<PORecord> = {
              id: `row-${index + 1}`,
              po: "",
              itemCode: "",
              color: "",
              quantity: 0,
              frontDm: 0,
              backDm: 0,
            };

            for (const header of headers) {
              const mapped = HEADER_ALIASES[header.norm];
              if (!mapped) continue;
              const value = normalizedRow[header.norm];
              if (mapped === "quantity" || mapped === "frontDm" || mapped === "backDm") {
                (record[mapped] as number | undefined) = toNumber(value);
              } else {
                (record[mapped] as string | undefined) = toText(value);
              }
            }

            return record as PORecord;
          })
          .filter((item) => item.po || item.itemCode || item.color || item.quantity || item.frontDm || item.backDm);

        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function exportScheduleToExcel(result: ScheduleResult, rows: PORecord[]): void {
  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet(
    result.teamDays.flatMap((day) =>
      day.rows.map((row) => ({
        Ngay: row.date,
        Thu: row.weekday,
        To: row.teamName,
        Loai: row.type,
        Ma_hang: row.itemCode,
        Mau_vai: row.color,
        Vai_tro: row.role,
        DM: row.dm,
        Luot: row.rounds,
        Phut: row.minutes,
        "SL_hom_nay": row.plannedQty,
        "Con_lai": row.remainingEnd,
      }))
    )
  );
  XLSX.utils.book_append_sheet(workbook, summarySheet, "KeHoachTheoNgay");

  const teamSheet = XLSX.utils.json_to_sheet(
    result.rows.map((row) => ({
      To: row.teamName,
      Ban: row.tables,
      Ngay: row.date,
      Thu: row.weekday,
      Loai: row.type,
      PO: row.po,
      Ma_hang: row.itemCode,
      Mau_vai: row.color,
      Vai_tro: row.role,
      DM: row.dm,
      Luot: row.rounds,
      Phut: row.minutes,
      "SL_hom_nay": row.plannedQty,
      "Con_lai": row.remainingEnd,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, teamSheet, "KeHoachTheoTo");

  const inputSheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      PO: row.po,
      "Ma hang": row.itemCode,
      "Mau vai": row.color,
      "So luong": row.quantity,
      FRONT: row.frontDm,
      BACK: row.backDm,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, inputSheet, "PO_Goc");

  XLSX.writeFile(workbook, "ke-hoach-in-lua.xlsx");
}

export function downloadTemplate(): void {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["PO", "Mã hàng", "Màu vải", "Số lượng", "FRONT", "BACK"],
    ["PO001", "1105689", "HCH", 7200, 16, 18],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "PO_Mau");
  XLSX.writeFile(workbook, "mau-nhap-po.xlsx");
}
