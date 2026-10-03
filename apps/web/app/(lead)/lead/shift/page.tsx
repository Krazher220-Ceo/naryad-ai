import { ShiftScreen, parseShift } from "@/components/reports/ShiftScreen";
import { requireRole } from "@/lib/auth/session";
import { t } from "@/lib/i18n";

export default async function LeadShiftPage({ searchParams }: PageProps<"/lead/shift">) {
  const employee = await requireRole("lead");
  const { date, shift } = await searchParams;
  const current = parseShift(date, shift);
  return (
    <ShiftScreen
      fullName={employee.fullName}
      roleLabel={t("roles.lead")}
      basePath="/lead"
      date={current.date}
      shift={current.shift}
    />
  );
}
