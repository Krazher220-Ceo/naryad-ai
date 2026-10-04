import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/AppShell";

// Общие для всех ролей экраны: профиль и уведомления.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  return <AppShell employee={employee}>{children}</AppShell>;
}
