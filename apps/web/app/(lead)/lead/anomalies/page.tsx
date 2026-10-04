import { ANOMALY_PERIODS, AnomaliesScreen } from "@/components/reports/AnomaliesScreen";
import { parseDaysIn } from "@/components/reports/format";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";

export default async function LeadAnomaliesPage({ searchParams }: PageProps<"/lead/anomalies">) {
  const t = await getT();
  const employee = await requireRole("lead");
  const { days } = await searchParams;
  return (
    <AnomaliesScreen
      fullName={employee.fullName}
      roleLabel={t("roles.lead")}
      basePath="/lead"
      days={parseDaysIn(days, ANOMALY_PERIODS, 90)}
    />
  );
}
