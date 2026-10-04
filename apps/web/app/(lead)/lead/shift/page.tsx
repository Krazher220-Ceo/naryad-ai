import { ShiftScreen, parseShift } from "@/components/reports/ShiftScreen";
import { requireRole } from "@/lib/auth/session";

export default async function LeadShiftPage({ searchParams }: PageProps<"/lead/shift">) {
  await requireRole("lead");
  const { date, shift } = await searchParams;
  const current = parseShift(date, shift);
  return (
    <ShiftScreen
      basePath="/lead"
      date={current.date}
      shift={current.shift}
    />
  );
}
