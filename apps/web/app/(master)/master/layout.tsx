import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/AppShell";

export default async function MasterLayout({ children }: LayoutProps<"/master">) {
  const employee = await requireRole("master");
  return <AppShell employee={employee}>{children}</AppShell>;
}
