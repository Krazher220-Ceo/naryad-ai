import { Card, EmptyState, cx } from "@/components/ui";
import type { MaterialRow } from "@/lib/analytics/reports";
import { t } from "@/lib/i18n";
import { fill, oneDecimal } from "./format";

// Перерасходом считается превышение нормы больше чем на 30%.
export const OVERUSE_PCT = 30;

const deviationText = (pct: number) => fill(t("materialsReport.deviationValue"), { sign: pct > 0 ? "+" : "", n: pct });
const qtyText = (row: MaterialRow, value: number) =>
  row.unit ? fill(t("materialsReport.qtyValue"), { qty: oneDecimal(value), unit: row.unit }) : oneDecimal(value);

// Отклонение: цвет и слово «перерасход» вместе, цвет один не несёт смысл.
function Deviation({ pct }: { pct: number }) {
  const over = pct > OVERUSE_PCT;
  return (
    <span className={cx("inline-flex flex-wrap items-center gap-2 text-base font-bold", over ? "text-danger" : "text-ink")}>
      {deviationText(pct)}
      {over && <span className="rounded-lg bg-danger px-2 py-0.5 text-base font-bold text-white">{t("materialsReport.overuse")}</span>}
    </span>
  );
}

export function MaterialsView({ rows }: { rows: MaterialRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title={t("materialsReport.emptyTitle")} text={t("materialsReport.emptyText")} />;
  }
  return (
    <>
      <ul className="flex flex-col gap-3 lg:hidden">
        {rows.map((r) => (
          <li key={r.key}>
            <Card tone={r.deviationPct > OVERUSE_PCT ? "emergency" : "default"} className="flex flex-col gap-2">
              <span className="text-lg font-bold text-ink">{r.name}</span>
              <Deviation pct={r.deviationPct} />
              <dl className="grid grid-cols-3 gap-2 text-base">
                <div>
                  <dt className="text-ink-muted">{t("materialsReport.col.qty")}</dt>
                  <dd className="font-semibold text-ink">{qtyText(r, r.qty)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("materialsReport.col.norm")}</dt>
                  <dd className="font-semibold text-ink">{qtyText(r, r.norm)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("materialsReport.col.orders")}</dt>
                  <dd className="font-semibold text-ink">{r.orders}</dd>
                </div>
              </dl>
            </Card>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface lg:block">
        <table className="w-full text-left text-base">
          <thead className="border-b border-line bg-canvas text-ink">
            <tr>
              <th className="px-4 py-3 font-bold">{t("materialsReport.col.name")}</th>
              <th className="px-4 py-3 text-right font-bold">{t("materialsReport.col.qty")}</th>
              <th className="px-4 py-3 text-right font-bold">{t("materialsReport.col.norm")}</th>
              <th className="px-4 py-3 font-bold">{t("materialsReport.col.deviation")}</th>
              <th className="px-4 py-3 text-right font-bold">{t("materialsReport.col.orders")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={cx("border-b border-line last:border-0", r.deviationPct > OVERUSE_PCT && "bg-danger-soft")}>
                <td className="px-4 py-3 font-semibold text-ink">{r.name}</td>
                <td className="px-4 py-3 text-right text-ink">{qtyText(r, r.qty)}</td>
                <td className="px-4 py-3 text-right text-ink">{qtyText(r, r.norm)}</td>
                <td className="px-4 py-3">
                  <Deviation pct={r.deviationPct} />
                </td>
                <td className="px-4 py-3 text-right text-ink">{r.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
