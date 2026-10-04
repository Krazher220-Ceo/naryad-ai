import { ShiftScreen, parseShift } from "@/components/reports/ShiftScreen";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";

export default async function LeadShiftPage({ searchParams }: PageProps<"/lead/shift">) {
  const t = await getT();
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
