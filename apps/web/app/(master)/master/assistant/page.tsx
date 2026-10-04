import { ReportPage } from "@/components/reports/ReportPage";
import { requireRole } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { AssistantChat } from "./AssistantChat";

export default async function MasterAssistantPage() {
  const employee = await requireRole("master");
  return (
    <ReportPage
      fullName={employee.fullName}
      roleLabel={t("roles.master")}
      backHref="/master"
      backLabel={t("assistant.back")}
      title={t("assistant.title")}
    >
      <AssistantChat />
    </ReportPage>
  );
}
