import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { getT } from "@/lib/i18n-server";
import { AnomalyList } from "./AnomalyList";
import { ExportButtons } from "./ExportButtons";
import { PeriodSwitch, ReportPage } from "./ReportPage";

export const ANOMALY_PERIODS = [30, 90] as const;

// Одна страница аномалий для мастера и руководителя.
export async function AnomaliesScreen({
  basePath,
  days,
}: {
  basePath: "/master" | "/lead";
  days: number;
}) {
  const t = await getT();
  return (
    <ReportPage backHref={basePath} backLabel={t("anomalies.back")} title={t("anomalies.title")}>
      <p className="text-base text-ink-muted">{t("anomalies.intro")}</p>
      <PeriodSwitch basePath={`${basePath}/anomalies`} days={days} options={ANOMALY_PERIODS} />
      <ExportButtons report="anomalies" params={{ days }} />
      <Suspense
        key={days}
        fallback={
          <div role="status" className="flex flex-col gap-3">
            <p className="text-base font-semibold text-ink">{t("anomalies.loading")}</p>
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        }
      >
        <AnomalyList days={days} showUpdated />
      </Suspense>
    </ReportPage>
  );
}
