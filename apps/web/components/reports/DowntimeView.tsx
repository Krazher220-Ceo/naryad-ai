// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { Card, EmptyState } from "@/components/ui";
import type { DowntimeReport } from "@/lib/analytics/reports";
import { getT } from "@/lib/i18n-server";
import { categoryLabel, fill, oneDecimal } from "./format";

// Полоса: ширина — доля от максимума. Число рядом, поэтому цвет не несёт смысл.
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-3 w-full rounded-full bg-line" aria-hidden="true">
      <div className="h-3 rounded-full bg-ink" style={{ width: `${Math.max(2, Math.round((value / Math.max(max, 0.1)) * 100))}%` }} />
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border-2 border-line bg-surface p-4">
      <span className="text-3xl font-bold text-ink">{value}</span>
      <span className="text-base font-semibold text-ink">{label}</span>
      {hint && <span className="text-base text-ink-muted">{hint}</span>}
    </div>
  );
}

export async function DowntimeView({ report }: { report: DowntimeReport }) {
  const t = await getT();
  const { rows, totalHours, byCategory, plannedSharePct } = report;
  if (rows.length === 0) {
    return <EmptyState title={t("downtimeReport.emptyTitle")} text={t("downtimeReport.emptyText")} />;
  }
  const maxCategory = Math.max(...byCategory.map((c) => c.hours));
  const maxHours = Math.max(...rows.map((r) => r.hours));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:max-w-xl">
        <Tile label={t("downtimeReport.total")} value={fill(t("downtimeReport.totalValue"), { h: oneDecimal(totalHours) })} />
        <Tile label={t("downtimeReport.plannedShare")} value={`${plannedSharePct}%`} hint={t("downtimeReport.plannedShareHint")} />
      </div>

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3 lg:max-w-xl">
          <h2 className="text-xl font-bold text-ink">{t("downtimeReport.byCategoryTitle")}</h2>
          <Card className="flex flex-col gap-3">
            {byCategory.map((c) => (
              <div key={c.category} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-base">
                  <span className="font-semibold text-ink">{categoryLabel(t, c.category)}</span>
                  <span className="text-ink">{fill(t("downtimeReport.totalValue"), { h: oneDecimal(c.hours) })}</span>
                </div>
                <Bar value={c.hours} max={maxCategory} />
              </div>
            ))}
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-ink">{t("downtimeReport.byEquipmentTitle")}</h2>
          <ul className="flex flex-col gap-3 lg:hidden">
            {rows.map((r) => (
              <li key={`${r.name}-${r.section}`}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-bold text-ink">{r.name}</span>
                    <span className="shrink-0 text-lg font-bold text-ink">{fill(t("downtimeReport.totalValue"), { h: oneDecimal(r.hours) })}</span>
                  </div>
                  <Bar value={r.hours} max={maxHours} />
                  <p className="text-base text-ink-muted">{r.section}</p>
                  <p className="text-base text-ink">
                    {fill(t("downtimeReport.unplannedCount"), { n: r.unplanned })}, {fill(t("downtimeReport.plannedCount"), { n: r.planned })} ·{" "}
                    {fill(t("downtimeReport.unplannedShareValue"), { n: r.unplannedSharePct })}
                  </p>
                  <p className="text-base text-ink">{fill(t("downtimeReport.topCauseValue"), { cause: categoryLabel(t, r.topCategory) })}</p>
                </Card>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface lg:block">
            <table className="w-full text-left text-base">
              <thead className="border-b border-line bg-canvas text-ink">
                <tr>
                  <th className="px-4 py-3 font-bold">{t("downtimeReport.col.equipment")}</th>
                  <th className="px-4 py-3 font-bold">{t("downtimeReport.col.section")}</th>
                  <th className="w-40 px-4 py-3 font-bold">{t("downtimeReport.col.hours")}</th>
                  <th className="px-4 py-3 text-right font-bold">{t("downtimeReport.col.unplanned")}</th>
                  <th className="px-4 py-3 text-right font-bold">{t("downtimeReport.col.planned")}</th>
                  <th className="px-4 py-3 text-right font-bold">{t("downtimeReport.col.unplannedShare")}</th>
                  <th className="px-4 py-3 font-bold">{t("downtimeReport.col.topCause")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.name}-${r.section}`} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{r.name}</td>
                    <td className="px-4 py-3 text-ink">{r.section}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-ink">{oneDecimal(r.hours)}</span>
                        <Bar value={r.hours} max={maxHours} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-ink">{r.unplanned}</td>
                    <td className="px-4 py-3 text-right text-ink">{r.planned}</td>
                    <td className="px-4 py-3 text-right text-ink">{r.unplannedSharePct}%</td>
                    <td className="px-4 py-3 text-ink">{categoryLabel(t, r.topCategory)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
