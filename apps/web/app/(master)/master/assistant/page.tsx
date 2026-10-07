// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { ReportPage } from "@/components/reports/ReportPage";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { AssistantChat } from "./AssistantChat";

export default async function MasterAssistantPage() {
  const t = await getT();
  await requireRole("master");
  return (
    <ReportPage
      backHref="/master"
      backLabel={t("assistant.back")}
      title={t("assistant.title")}
    >
      <AssistantChat />
    </ReportPage>
  );
}
