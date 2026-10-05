import Link from "next/link";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { ShiftReportView } from "@/components/reports/ShiftReportView";
import { cx } from "@/components/ui";
import { SnapshotBar } from "@/components/reports/SnapshotBar";
import { cachedShift } from "@/lib/analytics/cached";
import { currentShift, type Shift } from "@/lib/analytics/shift";
import { getT } from "@/lib/i18n-server";

// Разбор ?date=...&shift=...: неверные значения заменяются текущей сменой.
export function parseShift(date: string | string[] | undefined, shift: string | string[] | undefined): { date: string; shift: Shift } {
  const d = Array.isArray(date) ? date[0] : date;
  const s = Array.isArray(shift) ? shift[0] : shift;
  const validDate = !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime());
  if (!validDate || (s !== "A" && s !== "B")) return currentShift();
  return { date: d, shift: s };
}

const addDays = (date: string, n: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);

function neighbour(date: string, shift: Shift, dir: -1 | 1): { date: string; shift: Shift } {
  if (dir === 1) return shift === "A" ? { date, shift: "B" } : { date: addDays(date, 1), shift: "A" };
  return shift === "B" ? { date, shift: "A" } : { date: addDays(date, -1), shift: "B" };
}

const ruDate = (date: string) => date.split("-").reverse().join(".");

const linkClass =
  "flex min-h-touch items-center justify-center rounded-xl border-2 border-line-strong bg-surface px-3 text-center text-base font-semibold text-ink hover:bg-canvas";

// Одна страница отчёта за смену для мастера и руководителя.
export async function ShiftScreen({
  basePath,
  date,
  shift,
}: {
  basePath: "/master" | "/lead";
  date: string;
  shift: Shift;
}) {
  const t = await getT();
  const now = currentShift();
  const isCurrent = now.date === date && now.shift === shift;
  // Даты и смены сравниваются строкой: «2026-10-03A» < «2026-10-03B» < «2026-10-04A».
  const hasNext = `${date}${shift}` < `${now.date}${now.shift}`;
  const prev = neighbour(date, shift, -1);
  const next = neighbour(date, shift, 1);
  const href = (x: { date: string; shift: Shift }) => `${basePath}/shift?date=${x.date}&shift=${x.shift}`;

  const { data: report, computedAt } = await cachedShift(date, shift);

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 pb-8 lg:max-w-6xl">
        <Link href={basePath} className="inline-flex min-h-touch-sm items-center text-base font-semibold text-ink underline">
          ← {t("shiftReport.back")}
        </Link>
        <h1 className="text-2xl font-bold text-ink">{t("shiftReport.title")}</h1>
        <p className="text-lg font-semibold text-ink">
          {t("shiftReport.shiftName").replace("{shift}", shift).replace("{date}", ruDate(date))}
          <span className="block text-base font-normal text-ink-muted">{t(shift === "A" ? "shiftReport.shiftA" : "shiftReport.shiftB")}</span>
        </p>

        <nav className="grid grid-cols-2 gap-2 lg:max-w-xl">
          <Link href={href(prev)} className={linkClass}>
            ← {t("shiftReport.prev")}
          </Link>
          {hasNext ? (
            <Link href={href(next)} className={linkClass}>
              {t("shiftReport.next")} →
            </Link>
          ) : (
            <span className={cx(linkClass, "opacity-40")} aria-disabled="true">
              {t("shiftReport.next")} →
            </span>
          )}
          {!isCurrent && (
            <Link href={`${basePath}/shift`} className={cx(linkClass, "col-span-2 border-brand bg-brand text-white hover:bg-brand-hover")}>
              {t("shiftReport.current")}
            </Link>
          )}
        </nav>

        <SnapshotBar kind="shift" scope={`${date}:${shift}`} computedAt={computedAt} />
        <ExportButtons report="shift" params={{ date, shift }} />
        <ShiftReportView report={report} />
      </main>
    </div>
  );
}
