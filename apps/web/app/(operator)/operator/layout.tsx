import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getCurrentEmployee } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";

// Раздел оператора. Открывается и без входа: человек без входа считается оператором.
export default async function OperatorLayout({ children }: LayoutProps<"/operator">) {
  const employee = await getCurrentEmployee();
  if (employee && employee.role !== "operator") redirect(ROLE_HOME[employee.role]);
  return <AppShell employee={employee}>{children}</AppShell>;
}
