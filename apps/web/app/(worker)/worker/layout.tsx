import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/AppShell";

export default async function WorkerLayout({ children }: LayoutProps<"/worker">) {
  const employee = await requireRole("worker");
  return <AppShell employee={employee}>{children}</AppShell>;
}
