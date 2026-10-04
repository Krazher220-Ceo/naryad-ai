import { ToastProvider } from "@/components/ui";
import type { CurrentEmployee } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { ConnectionProvider } from "@/lib/offline/ConnectionProvider";
import { createClient } from "@/lib/supabase/server";
import { ShellFrame } from "./ShellFrame";

// Каркас для всех экранов после входа. Кладётся в layout роли один раз.
// Всплывающие сообщения и связь работают на любом экране внутри.
export async function AppShell({ employee, children }: { employee: CurrentEmployee; children: React.ReactNode }) {
  const t = await getT();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employee.id)
    .is("read_at", null);

  return (
    <ConnectionProvider>
      <ToastProvider>
        <ShellFrame
          role={employee.role}
          employeeId={employee.id}
          fullName={employee.fullName}
          roleLabel={t(`roles.${employee.role}`)}
          unread={count ?? 0}
        >
          {children}
        </ShellFrame>
      </ToastProvider>
    </ConnectionProvider>
  );
}
