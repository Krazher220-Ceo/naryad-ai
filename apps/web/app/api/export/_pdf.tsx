import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { t } from "@/lib/i18n";
import type { ReportDoc, Table } from "./_build";

// В стандартном шрифте PDF нет кириллицы, поэтому подключаем IBM Plex Sans (OFL), файлы лежат в public/fonts.
const fontDir = path.join(process.cwd(), "public/fonts");
Font.register({
  family: "Plex",
  fonts: [
    { src: path.join(fontDir, "IBMPlexSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "IBMPlexSans-Bold.ttf"), fontWeight: 700 },
  ],
});
// Без этого длинные русские слова переносятся по слогам с ошибками.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 9, padding: 28, paddingBottom: 44, color: "#0f172a" },
  title: { fontSize: 18, fontWeight: 700 },
  meta: { fontSize: 9, color: "#334155", marginTop: 2 },
  tableTitle: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cbd5e1" },
  head: { backgroundColor: "#e2e8f0", fontWeight: 700 },
  cell: { padding: 4 },
  footer: { position: "absolute", left: 28, right: 28, bottom: 18, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#334155" },
});

// Ширина колонки пропорциональна самому длинному тексту в ней, но не уже 4 и не шире 50 знаков.
function weights(table: Table): number[] {
  return table.head.map((h, i) => Math.min(50, Math.max(4, h.length, ...table.rows.map((r) => String(r[i] ?? "").length))));
}

function TableView({ table }: { table: Table }) {
  const w = weights(table);
  const total = w.reduce((s, x) => s + x, 0);
  const cellStyle = (i: number) => [styles.cell, { width: `${(w[i] / total) * 100}%` }];
  return (
    <View>
      <Text style={styles.tableTitle}>{table.name}</Text>
      <View style={[styles.row, styles.head]} wrap={false}>
        {table.head.map((h, i) => (
          <Text key={i} style={cellStyle(i)}>
            {h}
          </Text>
        ))}
      </View>
      {table.rows.map((row, r) => (
        <View key={r} style={styles.row} wrap={false}>
          {row.map((c, i) => (
            <Text key={i} style={cellStyle(i)}>
              {String(c)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export async function renderPdf(doc: ReportDoc): Promise<Buffer> {
  const generated = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Qostanay" });
  return renderToBuffer(
    <Document title={doc.title} language="ru">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{doc.title}</Text>
        <Text style={styles.meta}>{t("export.periodLabel").replace("{value}", doc.period)}</Text>
        <Text style={styles.meta}>{t("export.generatedAt").replace("{date}", generated)}</Text>
        {doc.tables.map((table) => (
          <TableView key={table.name} table={table} />
        ))}
        <View style={styles.footer} fixed>
          <Text>{t("export.footer")}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>,
  );
}
