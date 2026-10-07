// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/AppShell";

export default async function LeadLayout({ children }: LayoutProps<"/lead">) {
  const employee = await requireRole("lead");
  return <AppShell employee={employee}>{children}</AppShell>;
}
