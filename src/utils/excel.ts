import * as XLSX from "xlsx";

export type ExcelSheet = {
  name: string;
  rows?: Record<string, string | number | boolean | null>[];
  aoa?: (string | number | boolean | null)[][];
};

export function exportWorkbookToExcel({
  fileName,
  sheets
}: {
  fileName: string;
  sheets: ExcelSheet[];
}) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const worksheet = sheet.aoa
      ? XLSX.utils.aoa_to_sheet(sheet.aoa)
      : XLSX.utils.json_to_sheet(sheet.rows ?? []);

    worksheet["!cols"] = getColumnWidths(sheet);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  });

  XLSX.writeFile(workbook, fileName);
}

function getColumnWidths(sheet: ExcelSheet) {
  const rows = sheet.rows?.length
    ? [Object.keys(sheet.rows[0]), ...sheet.rows.map((row) => Object.values(row).map((value) => String(value ?? "")))]
    : sheet.aoa ?? [];

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return Array.from({ length: columnCount }, (_, index) => {
    const width = rows.reduce((max, row) => Math.max(max, String(row[index] ?? "").length), 10);
    return { wch: Math.min(Math.max(width + 2, 12), 34) };
  });
}
