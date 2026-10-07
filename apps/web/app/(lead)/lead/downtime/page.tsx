// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { DowntimeView } from "@/components/reports/DowntimeView";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { PERIODS, parseDaysIn } from "@/components/reports/format";
import { PeriodSwitch, ReportPage } from "@/components/reports/ReportPage";
import { SnapshotBar } from "@/components/reports/SnapshotBar";
import { cachedDowntime } from "@/lib/analytics/cached";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";

export default async function LeadDowntimePage({ searchParams }: PageProps<"/lead/downtime">) {
  const t = await getT();
  await requireRole("lead");
  const { days: daysParam } = await searchParams;
  const days = parseDaysIn(daysParam, PERIODS, 30);
  const { data: report, computedAt } = await cachedDowntime(days);

  return (
    <ReportPage
      backHref="/lead"
      backLabel={t("downtimeReport.back")}
      title={t("downtimeReport.title")}
    >
      <PeriodSwitch basePath="/lead/downtime" days={days} options={PERIODS} />
      <SnapshotBar kind="downtime" scope={String(days)} computedAt={computedAt} />
      <ExportButtons report="downtime" params={{ days }} />
      <p className="text-base text-ink-muted">{t("downtimeReport.note")}</p>
      <DowntimeView report={report} />
    </ReportPage>
  );
}
