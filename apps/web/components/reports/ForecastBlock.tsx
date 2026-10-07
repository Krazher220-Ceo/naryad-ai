// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { Card, EmptyState, cx } from "@/components/ui";
import { cachedForecast } from "@/lib/analytics/cached";
import type { EquipmentForecast } from "@/lib/analytics/forecast";
import type { Translate } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { fill, formatP, oneDecimal } from "./format";

// Блок «Риск отказа на неделю»: верхние машины по вероятности отказа. Цифры считает код (lib/analytics/forecast.ts),
// строка причины собирается из кодов причин по словарю.

const SPARK_W = 91;
const SPARK_H = 32;

// Маленький график: столбики — отказы по неделям, линия — сглаженный тренд (EWMA).
function Sparkline({ weekly, smooth, label }: { weekly: number[]; smooth: number[]; label: string }) {
  const max = Math.max(1, ...weekly, ...smooth);
  const step = SPARK_W / weekly.length;
  const y = (v: number) => SPARK_H - 2 - (v / max) * (SPARK_H - 4);
  const line = smooth.map((v, i) => `${(i * step + step / 2).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} width={SPARK_W} height={SPARK_H} role="img" aria-label={label} className="shrink-0">
      {weekly.map((v, i) =>
        v > 0 ? <rect key={i} x={i * step + 1} y={y(v)} width={step - 2} height={SPARK_H - 2 - y(v)} className="fill-line" /> : null,
      )}
      <polyline points={line} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="stroke-brand" />
    </svg>
  );
}

// Одна строка причины: берётся самая важная из кодов (порядок кодов задаёт forecast.ts).
export function reasonText(t: Translate, f: EquipmentForecast): string {
  const code = f.reasons[0];
  switch (code) {
    case "trend_up":
      return fill(t("forecast.reason.trend_up"), { k: f.failures30, exp: oneDecimal(f.expected30), p: formatP(f.pValue) });
    case "high_rate":
      return fill(t("forecast.reason.high_rate"), { ratio: oneDecimal(f.rateRatio), n: f.failures90d });
    case "recent_failure":
      return fill(t("forecast.reason.recent_failure"), { d: oneDecimal(f.daysSinceLast ?? 0) });
    case "little_data":
      return fill(t("forecast.reason.little_data"), { n: f.failures90d });
    default:
      return t("forecast.reason.stable");
  }
}

export async function ForecastBlock({ limit = 5 }: { limit?: number }) {
  const t = await getT();
  const { data } = await cachedForecast();
  const top = data.items.filter((i) => i.failures90d > 0).slice(0, limit);

  return (
    <section aria-label={t("forecast.title")} className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-bold text-ink">{t("forecast.title")}</h2>
        <p className="text-base text-ink-muted">{t("forecast.hint")}</p>
      </div>
      {top.length === 0 ? (
        <EmptyState title={t("forecast.empty")} text={t("dashboard.noDataText")} />
      ) : (
        <ol className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
          {top.map((f) => {
            const percent = Math.round(f.p7 * 100);
            const high = percent >= 50;
            return (
              <li key={f.equipmentId}>
                <Card tone={high ? "emergency" : "default"} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-ink">{f.name}</h3>
                      {f.section && <p className="text-base text-ink-muted">{f.section}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cx("text-3xl font-bold", high ? "text-danger" : "text-ink")}>{percent}%</p>
                      <p className="text-sm text-ink-muted">{t("forecast.probLabel")}</p>
                    </div>
                  </div>
                  <p className="text-base text-ink">{reasonText(t, f)}</p>
                  <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                    <ul className="flex flex-col text-base text-ink-muted">
                      <li>{fill(t("forecast.mtbf"), { d: oneDecimal(f.mtbfDays) })}</li>
                      <li>
                        {f.daysSinceLast === null
                          ? t("forecast.noFailures")
                          : fill(t("forecast.sinceLast"), { d: oneDecimal(f.daysSinceLast) })}
                      </li>
                    </ul>
                    <Sparkline weekly={f.weekly} smooth={f.weeklyEwma} label={t("forecast.sparkLabel")} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
