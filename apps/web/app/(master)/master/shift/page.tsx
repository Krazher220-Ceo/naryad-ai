import { ShiftScreen, parseShift } from "@/components/reports/ShiftScreen";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";

export default async function MasterShiftPage({ searchParams }: PageProps<"/master/shift">) {
  const t = await getT();
  const employee = await requireRole("master");
  const { date, shift } = await searchParams;
  const current = parseShift(date, shift);
  return (
    <ShiftScreen
      fullName={employee.fullName}
      roleLabel={t("roles.master")}
      basePath="/master"
      date={current.date}
      shift={current.shift}
    />
  );
}
