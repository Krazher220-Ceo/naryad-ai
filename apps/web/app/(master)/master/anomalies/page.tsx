import { ANOMALY_PERIODS, AnomaliesScreen } from "@/components/reports/AnomaliesScreen";
import { parseDaysIn } from "@/components/reports/format";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";

export default async function MasterAnomaliesPage({ searchParams }: PageProps<"/master/anomalies">) {
  const t = await getT();
  const employee = await requireRole("master");
  const { days } = await searchParams;
  return (
    <AnomaliesScreen
      fullName={employee.fullName}
      roleLabel={t("roles.master")}
      basePath="/master"
      days={parseDaysIn(days, ANOMALY_PERIODS, 90)}
    />
  );
}
