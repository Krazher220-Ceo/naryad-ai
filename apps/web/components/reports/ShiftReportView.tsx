import { Card, cx, formatMinutes } from "@/components/ui";
import { getT } from "@/lib/i18n-server";
import type { ShiftReport } from "@/lib/analytics/shift";

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), template);

function Tile({ label, value, alert, note }: { label: string; value: number; alert?: boolean; note?: string }) {
  const red = alert && value > 0;
  return (
    <div className={cx("flex flex-col gap-1 rounded-2xl border-2 p-4", red ? "border-danger bg-danger-soft" : "border-line bg-surface")}>
      <span className={cx("text-3xl font-bold", red ? "text-danger" : "text-ink")}>{value}</span>
      <span className="text-base font-semibold text-ink">{label}</span>
      {note && <span className="text-sm text-ink-muted">{note}</span>}
    </div>
  );
}

export async function ShiftReportView({ report }: { report: ShiftReport }) {
  const t = await getT();
  const { counters, load, downtime, overdue, summary } = report;
  const maxHours = Math.max(1, ...load.map((l) => l.normHours));
  const maxMinutes = Math.max(1, ...downtime.map((d) => d.minutes));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label={t("shiftReport.counters.issued")}
          value={counters.issued}
          note={counters.emergency > 0 ? fill(t("shiftReport.emergencyNote"), { n: counters.emergency }) : undefined}
        />
        <Tile label={t("shiftReport.counters.done")} value={counters.done} />
        <Tile label={t("shiftReport.counters.overdue")} value={counters.overdue} alert />
        <Tile label={t("shiftReport.counters.rejected")} value={counters.rejected} />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">{t("shiftReport.summaryTitle")}</h2>
          <span className="rounded-full border border-line-strong px-3 py-1 text-sm font-semibold text-ink-muted">
            {t(`ai.source.${summary.source}`)}
          </span>
        </div>
        <p className="mt-2 text-base text-ink">{summary.summary}</p>
      </Card>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-ink">{t("shiftReport.loadTitle")}</h2>
          {load.length === 0 ? (
            <p className="text-base text-ink-muted">{t("shiftReport.loadEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {load.map((l) => (
                <li key={l.name}>
                  <Card className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-bold text-ink">{l.name}</span>
                      <span className="text-sm text-ink-muted">
                        {fill(t("shiftReport.loadItem"), { n: l.done, h: String(Math.round(l.normHours * 10) / 10).replace(".", ",") })}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(l.normHours / maxHours) * 100}%` }} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-ink">{t("shiftReport.downtimeTitle")}</h2>
          {downtime.length === 0 ? (
            <p className="text-base text-ink-muted">{t("shiftReport.downtimeEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {downtime.slice(0, 5).map((d) => (
                <li key={d.name}>
                  <Card className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-bold text-ink">{d.name}</span>
                      <span className="shrink-0 text-base font-semibold text-danger">{formatMinutes(t, d.minutes)}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                      <div className="h-full rounded-full bg-danger" style={{ width: `${(d.minutes / maxMinutes) * 100}%` }} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-3 text-xl font-bold text-ink">{t("shiftReport.overdueTitle")}</h2>
          {overdue.length === 0 ? (
            <p className="text-base text-ink-muted">{t("shiftReport.overdueEmpty")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {overdue.map((n) => (
                <li key={n} className="rounded-full border-2 border-danger bg-danger-soft px-3 py-1 text-base font-bold text-danger">
                  {fill(t("shiftReport.orderNumber"), { n })}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
