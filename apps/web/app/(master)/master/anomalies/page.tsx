// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { ANOMALY_PERIODS, AnomaliesScreen } from "@/components/reports/AnomaliesScreen";
import { parseDaysIn } from "@/components/reports/format";
import { requireRole } from "@/lib/auth/session";

export default async function MasterAnomaliesPage({ searchParams }: PageProps<"/master/anomalies">) {
  await requireRole("master");
  const { days } = await searchParams;
  return (
    <AnomaliesScreen
      basePath="/master"
      days={parseDaysIn(days, ANOMALY_PERIODS, 90)}
    />
  );
}
