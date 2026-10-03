import { DowntimeView } from "@/components/reports/DowntimeView";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { PERIODS, parseDaysIn } from "@/components/reports/format";
import { PeriodSwitch, ReportPage } from "@/components/reports/ReportPage";
import { getDowntimeReport } from "@/lib/analytics/reports";
import { requireRole } from "@/lib/auth/session";
import { t } from "@/lib/i18n";

export default async function LeadDowntimePage({ searchParams }: PageProps<"/lead/downtime">) {
  const employee = await requireRole("lead");
  const { days: daysParam } = await searchParams;
  const days = parseDaysIn(daysParam, PERIODS, 30);
  const report = await getDowntimeReport(days);

  return (
    <ReportPage
      fullName={employee.fullName}
      roleLabel={t("roles.lead")}
      backHref="/lead"
      backLabel={t("downtimeReport.back")}
      title={t("downtimeReport.title")}
    >
      <PeriodSwitch basePath="/lead/downtime" days={days} options={PERIODS} />
      <ExportButtons report="downtime" params={{ days }} />
      <p className="text-base text-ink-muted">{t("downtimeReport.note")}</p>
      <DowntimeView report={report} />
    </ReportPage>
  );
}
