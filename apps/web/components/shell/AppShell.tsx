// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { ToastProvider } from "@/components/ui";
import type { CurrentEmployee } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { ConnectionProvider } from "@/lib/offline/ConnectionProvider";
import { ShellFrame } from "./ShellFrame";
import { OfflineWarmup } from "@/components/OfflineWarmup";

// Каркас для всех экранов после входа. Кладётся в layout роли один раз.
// Всплывающие сообщения и связь работают на любом экране внутри.
// employee = null — оператор без входа (раздел /operator).
export async function AppShell({ employee, children }: { employee: CurrentEmployee | null; children: React.ReactNode }) {
  const t = await getT();
  // Число непрочитанных колокольчик считает сам в браузере (NotificationBell): страница его не ждёт.

  return (
    <ConnectionProvider>
      <OfflineWarmup role={employee?.role ?? "operator"} />
      <ToastProvider>
        <ShellFrame
          role={employee?.role ?? "operator"}
          employeeId={employee?.id ?? null}
          fullName={employee?.fullName ?? t("shell.guest")}
          roleLabel={t(`roles.${employee?.role ?? "operator"}`)}
          unread={0}
        >
          {children}
        </ShellFrame>
      </ToastProvider>
    </ConnectionProvider>
  );
}
