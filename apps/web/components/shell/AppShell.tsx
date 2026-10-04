import { ToastProvider } from "@/components/ui";
import type { CurrentEmployee } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { ConnectionProvider } from "@/lib/offline/ConnectionProvider";
import { createClient } from "@/lib/supabase/server";
import { ShellFrame } from "./ShellFrame";

// Каркас для всех экранов после входа. Кладётся в layout роли один раз.
// Всплывающие сообщения и связь работают на любом экране внутри.
// employee = null — оператор без входа (раздел /operator).
export async function AppShell({ employee, children }: { employee: CurrentEmployee | null; children: React.ReactNode }) {
  const t = await getT();
  let count: number | null = 0;
  if (employee) {
    const supabase = await createClient();
    ({ count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employee.id)
      .is("read_at", null));
  }

  return (
    <ConnectionProvider>
      <ToastProvider>
        <ShellFrame
          role={employee?.role ?? "operator"}
          employeeId={employee?.id ?? null}
          fullName={employee?.fullName ?? t("shell.guest")}
          roleLabel={t(`roles.${employee?.role ?? "operator"}`)}
          unread={count ?? 0}
        >
          {children}
        </ShellFrame>
      </ToastProvider>
    </ConnectionProvider>
  );
}
