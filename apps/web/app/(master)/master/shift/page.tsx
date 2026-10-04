import { ShiftScreen, parseShift } from "@/components/reports/ShiftScreen";
import { requireRole } from "@/lib/auth/session";

export default async function MasterShiftPage({ searchParams }: PageProps<"/master/shift">) {
  await requireRole("master");
  const { date, shift } = await searchParams;
  const current = parseShift(date, shift);
  return (
    <ShiftScreen
      basePath="/master"
      date={current.date}
      shift={current.shift}
    />
  );
}
