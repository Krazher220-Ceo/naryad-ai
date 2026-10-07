// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { factLabel, factValue, categoryLabel } from "@/components/reports/format";
// Выгрузка берёт те же снимки, что и страницы: файл совпадает с тем, что на экране.
import { cachedAnomalies, cachedDowntime, cachedMaterials, cachedRating, cachedShift } from "@/lib/analytics/cached";
import { periodFromDays, type MaterialRow } from "@/lib/analytics/reports";
import type { Shift } from "@/lib/analytics/shift";
import { tRu as t, type MessageKey } from "@/lib/i18n";

// Любой отчёт — это заголовок и несколько таблиц. Из них собираются и Excel, и PDF.
export type Cell = string | number;
export type Table = { name: string; head: string[]; rows: Cell[][] };
export type ReportDoc = { title: string; period: string; fileName: string; tables: Table[] };

export type ReportParams = { days: number; date: string; shift: Shift };

const ruDate = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join(".");

function periodText(days: number): string {
  const { from, to } = periodFromDays(days);
  return t("export.periodRange").replace("{n}", String(days)).replace("{from}", ruDate(from)).replace("{to}", ruDate(to));
}

const materialTable = (name: string, rows: MaterialRow[]): Table => ({
  name,
  head: [t("materialsReport.col.name"), t("materialsReport.col.qty"), t("materialsReport.col.norm"), t("export.col.unit"), t("materialsReport.col.deviation"), t("materialsReport.col.orders")],
  rows: rows.map((r) => [
    r.name,
    r.qty,
    r.norm,
    r.unit ?? "",
    `${r.deviationPct > 0 ? "+" : ""}${r.deviationPct}%${r.deviationPct > 30 ? ` — ${t("materialsReport.overuse")}` : ""}`,
    r.orders,
  ]),
});

async function materials(p: ReportParams): Promise<ReportDoc> {
  const { data: r } = await cachedMaterials(p.days);
  return {
    title: t("materialsReport.title"),
    period: periodText(p.days),
    fileName: `naryad-materials-${p.days}d`,
    tables: [
      materialTable(t("materialsReport.tab.material"), r.byMaterial),
      materialTable(t("materialsReport.tab.section"), r.bySection),
      materialTable(t("materialsReport.tab.equipment"), r.byEquipment),
      materialTable(t("materialsReport.tab.worker"), r.byWorker),
    ],
  };
}

async function downtime(p: ReportParams): Promise<ReportDoc> {
  const { data: r } = await cachedDowntime(p.days);
  return {
    title: t("downtimeReport.title"),
    period: periodText(p.days),
    fileName: `naryad-downtime-${p.days}d`,
    tables: [
      {
        name: t("export.sheet.summary"),
        head: [t("export.col.name"), t("export.col.value")],
        rows: [
          [t("downtimeReport.total"), r.totalHours],
          [t("downtimeReport.plannedShare"), `${r.plannedSharePct}%`],
        ],
      },
      {
        name: t("export.sheet.equipment"),
        head: [
          t("downtimeReport.col.equipment"),
          t("downtimeReport.col.section"),
          t("downtimeReport.col.hours"),
          t("downtimeReport.col.unplanned"),
          t("downtimeReport.col.planned"),
          t("downtimeReport.col.unplannedShare"),
          t("downtimeReport.col.topCause"),
        ],
        rows: r.rows.map((x) => [x.name, x.section, x.hours, x.unplanned, x.planned, `${x.unplannedSharePct}%`, categoryLabel(t, x.topCategory)]),
      },
      {
        name: t("export.sheet.categories"),
        head: [t("downtimeReport.byCategoryTitle"), t("downtimeReport.col.hours")],
        rows: r.byCategory.map((c) => [categoryLabel(t, c.category), c.hours]),
      },
    ],
  };
}

async function rating(p: ReportParams): Promise<ReportDoc> {
  const { data: rows } = await cachedRating(p.days);
  return {
    title: t("rating.title"),
    period: periodText(p.days),
    fileName: `naryad-rating-${p.days}d`,
    tables: [
      {
        name: t("export.sheet.rating"),
        head: [
          t("export.col.rank"),
          t("rating.table.worker"),
          t("export.col.brigade"),
          t("export.col.closed"),
          t("rating.total"),
          t("rating.parts.quality"),
          t("rating.parts.onTime"),
          t("rating.parts.noReturns"),
          t("rating.parts.volume"),
          t("rating.parts.noRefusal"),
        ],
        rows: rows.map((r, i) => [
          i + 1,
          r.fullName,
          r.brigade ?? "",
          r.closedOrders,
          Math.round(r.total),
          Math.round(r.parts.quality),
          Math.round(r.parts.onTime),
          Math.round(r.parts.noReturns),
          Math.round(r.parts.volume),
          Math.round(r.parts.noRefusal),
        ]),
      },
    ],
  };
}

async function shift(p: ReportParams): Promise<ReportDoc> {
  const { data: r } = await cachedShift(p.date, p.shift);
  const shiftName = t("shiftReport.shiftName").replace("{shift}", p.shift).replace("{date}", p.date.split("-").reverse().join("."));
  return {
    title: t("shiftReport.title"),
    period: `${shiftName}, ${t(p.shift === "A" ? "shiftReport.shiftA" : "shiftReport.shiftB")}`,
    fileName: `naryad-shift-${p.date}-${p.shift}`,
    tables: [
      {
        name: t("export.sheet.counters"),
        head: [t("export.col.name"), t("export.col.value")],
        rows: [
          [t("shiftReport.counters.issued"), r.counters.issued],
          [t("shiftReport.counters.done"), r.counters.done],
          [t("shiftReport.counters.overdue"), r.counters.overdue],
          [t("shiftReport.counters.rejected"), r.counters.rejected],
          [t("shiftReport.emergencyNote").replace("{n}", String(r.counters.emergency)), r.counters.emergency],
          [t("shiftReport.summaryTitle"), r.summary.summary],
        ],
      },
      {
        name: t("export.sheet.load"),
        head: [t("rating.table.worker"), t("export.col.done"), t("export.col.norm")],
        rows: r.load.map((l) => [l.name, l.done, Math.round(l.normHours * 10) / 10]),
      },
      {
        name: t("export.sheet.downtime"),
        head: [t("downtimeReport.col.equipment"), t("export.col.minutes")],
        rows: r.downtime.map((d) => [d.name, d.minutes]),
      },
      {
        name: t("export.sheet.overdue"),
        head: [t("export.col.number")],
        rows: r.overdue.map((n) => [n]),
      },
    ],
  };
}

async function anomalies(p: ReportParams): Promise<ReportDoc> {
  const { data } = await cachedAnomalies(p.days);
  const list = data.anomalies;
  return {
    title: t("anomalies.title"),
    period: periodText(p.days),
    fileName: `naryad-anomalies-${p.days}d`,
    tables: [
      {
        name: t("export.sheet.anomalies"),
        head: [
          t("export.col.severity"),
          t("export.col.kind"),
          t("export.col.subject"),
          t("export.col.text"),
          t("anomalies.recommendationTitle"),
          t("export.col.fact"),
          t("export.col.source"),
        ],
        rows: list.map((a) => [
          t(`anomalies.severity.${a.severity}`),
          t(`anomalies.kind.${a.kind}`),
          a.subject,
          a.text,
          a.recommendation,
          Object.entries(a.facts)
            .map(([k, v]) => `${factLabel(t, k)}: ${factValue(t, k, v)}`)
            .join("; "),
          t(`ai.source.${a.source}` as MessageKey),
        ]),
      },
    ],
  };
}

export const BUILDERS = { materials, downtime, rating, shift, anomalies } as const;
export type ReportName = keyof typeof BUILDERS;
export const isReportName = (x: string): x is ReportName => x in BUILDERS;
