import Link from "next/link";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { MaterialsView } from "@/components/reports/MaterialsView";
import { PERIODS, parseDaysIn } from "@/components/reports/format";
import { PeriodSwitch, ReportPage } from "@/components/reports/ReportPage";
import { cx } from "@/components/ui";
import { SnapshotBar } from "@/components/reports/SnapshotBar";
import { cachedMaterials } from "@/lib/analytics/cached";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";

const TABS = ["material", "section", "equipment", "worker"] as const;
type Tab = (typeof TABS)[number];
const ROWS_OF: Record<Tab, "byMaterial" | "bySection" | "byEquipment" | "byWorker"> = {
  material: "byMaterial",
  section: "bySection",
  equipment: "byEquipment",
  worker: "byWorker",
};

export default async function LeadMaterialsPage({ searchParams }: PageProps<"/lead/materials">) {
  const t = await getT();
  await requireRole("lead");
  const query = await searchParams;
  const days = parseDaysIn(query.days, PERIODS, 30);
  const tabParam = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const tab = TABS.find((x) => x === tabParam) ?? "material";

  const { data: report, computedAt } = await cachedMaterials(days);

  return (
    <ReportPage
      backHref="/lead"
      backLabel={t("materialsReport.back")}
      title={t("materialsReport.title")}
    >
      <PeriodSwitch basePath="/lead/materials" days={days} options={PERIODS} extraQuery={`&tab=${tab}`} />
      <nav aria-label={t("materialsReport.tabsLabel")} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {TABS.map((x) => (
          <Link
            key={x}
            href={`/lead/materials?days=${days}&tab=${x}`}
            aria-current={x === tab ? "page" : undefined}
            className={cx(
              "flex min-h-touch items-center justify-center rounded-xl border-2 px-2 text-center text-base font-semibold",
              x === tab ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas",
            )}
          >
            {t(`materialsReport.tab.${x}`)}
          </Link>
        ))}
      </nav>
      <SnapshotBar kind="materials" scope={String(days)} computedAt={computedAt} />
      <ExportButtons report="materials" params={{ days }} />
      <p className="text-base text-ink-muted">{t("materialsReport.note")}</p>
      <MaterialsView rows={report[ROWS_OF[tab]]} />
    </ReportPage>
  );
}
