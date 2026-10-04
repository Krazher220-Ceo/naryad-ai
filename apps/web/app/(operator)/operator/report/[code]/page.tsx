import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { getCurrentEmployee } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { resolveCode } from "@/lib/requests/lookup";
import { ReportForm } from "./ReportForm";

// «Сообщить о поломке» (PLAN.md, раздел 8.3). Машина уже выбрана по QR.
// QR цеха без выбранной машины ведёт на список машин цеха.
export default async function ReportPage({ params, searchParams }: PageProps<"/operator/report/[code]">) {
  const { code } = await params;
  const { machine } = await searchParams;
  const t = await getT();
  const target = await resolveCode(code);
  const employee = await getCurrentEmployee();

  if (!target) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:py-8">
        <EmptyState title={t("shell.titles.report")} text={t("report.notFound")} />
      </main>
    );
  }

  let place: { title: string; subtitle: string; equipmentId: string | null };
  let warning: string | null = null;
  if (target.kind === "equipment") {
    place = { title: target.equipment.name, subtitle: `${target.equipment.sectionName} · ${target.equipment.inventoryNo}`, equipmentId: null };
    if (target.openOrderNumber) warning = t("report.duplicate").replace("{n}", String(target.openOrderNumber));
    else if (target.pendingRequestNumber) warning = t("report.pending").replace("{n}", String(target.pendingRequestNumber));
  } else {
    const machineId = typeof machine === "string" ? machine : null;
    if (!machineId) redirect(`/operator/section/${encodeURIComponent(target.code)}`);
    const picked = target.groups.flatMap((g) => g.machines).find((m) => m.id === machineId);
    place = picked
      ? { title: picked.name, subtitle: `${target.section.name} · ${picked.inventoryNo}`, equipmentId: picked.id }
      : { title: target.section.name, subtitle: t("report.sectionWide"), equipmentId: null };
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:max-w-3xl lg:py-8">
      <h1 className="hidden text-3xl font-semibold text-ink lg:block">{t("shell.titles.report")}</h1>
      <ReportForm
        code={target.code}
        place={place}
        warning={warning}
        accountName={employee?.role === "operator" ? employee.fullName : null}
      />
    </main>
  );
}
