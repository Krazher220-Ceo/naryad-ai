import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/AppShell";

export default async function LeadLayout({ children }: LayoutProps<"/lead">) {
  const employee = await requireRole("lead");
  return <AppShell employee={employee}>{children}</AppShell>;
}
