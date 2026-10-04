import Link from "next/link";
import { Card, cx } from "@/components/ui";
import { findAnomalies, type Anomaly } from "@/lib/analytics/anomalies";
import { type MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { factLabel, factValue } from "./format";

export async function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const t = await getT();
  const high = anomaly.severity === "high";
  return (
    <Card tone={high ? "emergency" : "default"} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cx(
            "inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-base font-bold",
            high ? "bg-danger text-white" : "border-2 border-accent-ink bg-warning-soft text-ink",
          )}
        >
          {high && <span aria-hidden="true">⚠</span>}
          {t(`anomalies.severity.${anomaly.severity}`)}
        </span>
        <span className="text-base font-semibold text-ink-muted">{t(`anomalies.kind.${anomaly.kind}`)}</span>
      </div>

      <h3 className="text-xl font-bold text-ink">{anomaly.subject}</h3>
      <p className="text-base text-ink">{anomaly.text}</p>

      <div>
        <p className="text-base font-bold text-ink">{t("anomalies.recommendationTitle")}</p>
        <p className="text-base text-ink">{anomaly.recommendation}</p>
      </div>

      <ul aria-label={t("anomalies.factsTitle")} className="flex flex-wrap gap-2">
        {Object.entries(anomaly.facts).map(([key, value]) => (
          <li key={key} className="rounded-full border border-line-strong bg-canvas px-3 py-1 text-base text-ink">
            {factLabel(t, key)}: <span className="font-semibold">{factValue(t, key, value)}</span>
          </li>
        ))}
      </ul>

      <p className="text-base text-ink-muted">{t(`ai.source.${anomaly.source}` as MessageKey)}</p>
    </Card>
  );
}

// Список карточек. Вызывает модель (до 15 секунд), поэтому страница оборачивает его в <Suspense>.
export async function AnomalyList({ days, limit, allHref }: { days: number; limit?: number; allHref?: string }) {
  const t = await getT();
  const { anomalies } = await findAnomalies(days);
  const shown = limit ? anomalies.slice(0, limit) : anomalies;

  if (shown.length === 0) {
    return <p className="text-base text-ink-muted">{t("dashboard.anomaliesEmpty")}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
        {shown.map((a) => (
          <li key={a.id}>
            <AnomalyCard anomaly={a} />
          </li>
        ))}
      </ul>
      {allHref && (
        <Link
          href={allHref}
          className="flex min-h-touch items-center justify-center rounded-xl border-2 border-ink bg-surface px-4 text-lg font-semibold text-ink hover:bg-canvas lg:max-w-xs"
        >
          {t("dashboard.anomaliesAll")}
        </Link>
      )}
    </div>
  );
}
