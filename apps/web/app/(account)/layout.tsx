// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/AppShell";

// Общие для всех ролей экраны: профиль и уведомления.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  return <AppShell employee={employee}>{children}</AppShell>;
}
