import { ReportPage } from "@/components/reports/ReportPage";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { AssistantChat } from "./AssistantChat";

export default async function MasterAssistantPage() {
  const t = await getT();
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
