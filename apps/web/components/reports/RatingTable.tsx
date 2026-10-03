import { Card, cx } from "@/components/ui";
import { t } from "@/lib/i18n";
import { MIN_ORDERS, WEIGHTS, type RatingRow } from "@/lib/analytics/rating";

type PartKey = keyof RatingRow["parts"];
const PART_KEYS: PartKey[] = ["quality", "onTime", "noReturns", "volume", "noRefusal"];

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), template);

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

// Факт, из которого получилась составляющая: «опозданий 1», «2 возврата» и т.п.
function factText(key: PartKey, f: RatingRow["facts"]): string {
  switch (key) {
    case "quality":
      return f.avgScore === null ? t("rating.fact.qualityNone") : fill(t("rating.fact.quality"), { avg: oneDecimal(f.avgScore) });
    case "onTime":
      return fill(t("rating.fact.onTime"), { n: f.late });
    case "noReturns":
      return fill(t("rating.fact.noReturns"), { n: f.returns + f.repeats });
    case "volume":
      return fill(t("rating.fact.volume"), { h: oneDecimal(f.normHours) });
    case "noRefusal":
      return fill(t("rating.fact.noRefusal"), { n: f.badRefusals });
  }
}

// Пояснение одной строкой, собранное из фактов (без ИИ).
export function explainText(f: RatingRow["facts"]): string {
  const bad = f.returns + f.repeats;
  const parts = [
    f.avgScore === null ? t("rating.explain.noAvg") : fill(t("rating.explain.avg"), { avg: oneDecimal(f.avgScore) }),
    f.late > 0 ? fill(t("rating.explain.late"), { n: f.late }) : t("rating.explain.noLate"),
    bad > 0 ? fill(t("rating.explain.returns"), { n: bad }) : t("rating.explain.noReturns"),
    fill(t("rating.explain.hours"), { h: oneDecimal(f.normHours) }),
  ];
  if (f.badRefusals > 0) parts.push(fill(t("rating.explain.refusals"), { n: f.badRefusals }));
  return parts.join("; ");
}

function LowDataBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-warning-soft px-3 py-1 text-sm font-bold text-st-in-progress-fg">
      {t("rating.lowData")}
    </span>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

// Формула и веса — чтобы исполнитель понимал, как считается балл.
export function RatingFormula() {
  return (
    <Card>
      <h2 className="text-lg font-bold text-ink">{t("rating.formulaTitle")}</h2>
      <p className="mt-1 text-base text-ink-muted">{t("rating.formulaText")}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {PART_KEYS.map((k) => (
          <li key={k} className="rounded-full border border-line-strong px-3 py-1 text-sm font-semibold text-ink">
            {fill(t("rating.weight"), { name: t(`rating.parts.${k}`), pct: Math.round(WEIGHTS[k] * 100) })}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-muted">{fill(t("rating.lowDataHint"), { n: MIN_ORDERS })}</p>
    </Card>
  );
}

export function RatingTable({ rows }: { rows: RatingRow[] }) {
  return (
    <>
      {/* Телефон: карточки */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {rows.map((r, i) => (
          <li key={r.workerId}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-muted">#{i + 1}</p>
                  <p className="text-lg font-bold text-ink">{r.fullName}</p>
                  <p className="text-sm text-ink-muted">
                    {r.brigade ? `${r.brigade} · ` : ""}
                    {fill(t("rating.orders"), { n: r.closedOrders })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-4xl font-bold text-ink">{r.total}</p>
                  {r.lowData && <LowDataBadge />}
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-3">
                {PART_KEYS.map((k) => (
                  <li key={k} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-semibold text-ink">{t(`rating.parts.${k}`)}</span>
                      <span className="text-base font-bold text-ink">{r.parts[k]}%</span>
                    </div>
                    <Bar value={r.parts[k]} />
                    <span className="text-sm text-ink-muted">{factText(k, r.facts)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-sm text-ink-muted">
                <span className="font-semibold text-ink">{t("rating.explainTitle")}: </span>
                {explainText(r.facts)}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      {/* Ноутбук: таблица */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface lg:block">
        <table className="w-full text-left text-base">
          <thead className="bg-canvas text-sm text-ink-muted">
            <tr>
              <th className="px-3 py-3">{t("rating.table.rank")}</th>
              <th className="px-3 py-3">{t("rating.table.worker")}</th>
              <th className="px-3 py-3 text-right">{t("rating.total")}</th>
              {PART_KEYS.map((k) => (
                <th key={k} className="px-3 py-3 text-right">
                  {t(`rating.parts.${k}`)}
                </th>
              ))}
              <th className="px-3 py-3 text-right">{t("rating.table.orders")}</th>
              <th className="px-3 py-3">{t("rating.table.explain")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.workerId} className={cx("border-t border-line align-top", r.lowData && "bg-canvas")}>
                <td className="px-3 py-3 font-semibold text-ink-muted">{i + 1}</td>
                <td className="px-3 py-3">
                  <p className="font-bold text-ink">{r.fullName}</p>
                  <p className="text-sm text-ink-muted">{r.brigade}</p>
                  {r.lowData && <LowDataBadge />}
                </td>
                <td className="px-3 py-3 text-right text-2xl font-bold text-ink">{r.total}</td>
                {PART_KEYS.map((k) => (
                  <td key={k} className="px-3 py-3 text-right">
                    <span className="font-semibold text-ink">{r.parts[k]}%</span>
                    <span className="block text-xs text-ink-muted">{factText(k, r.facts)}</span>
                  </td>
                ))}
                <td className="px-3 py-3 text-right text-ink">{r.closedOrders}</td>
                <td className="max-w-64 px-3 py-3 text-sm text-ink-muted">{explainText(r.facts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
