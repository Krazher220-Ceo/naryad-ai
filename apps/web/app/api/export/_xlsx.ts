import writeXlsxFile from "write-excel-file/node";
import type { ReportDoc } from "./_build";

// Один лист на таблицу, первая строка — жирный заголовок. Листы в Excel называются не длиннее 31 знака.
export async function renderXlsx(doc: ReportDoc): Promise<Buffer> {
  const sheets = doc.tables.map((table) => {
    const widths = table.head.map((h, i) =>
      Math.min(60, Math.max(h.length, ...table.rows.map((r) => String(r[i] ?? "").length), 8) + 2),
    );
    return {
      sheet: table.name.slice(0, 31),
      columns: widths.map((width) => ({ width })),
      data: [
        table.head.map((h) => ({ value: h, fontWeight: "bold" as const })),
        ...table.rows.map((row) => row.map((c) => ({ value: c }))),
      ],
    };
  });
  return writeXlsxFile(sheets).toBuffer();
}
