import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { AppHeader } from "@/components/AppHeader";
import { TelegramLinkCard } from "@/components/TelegramLinkCard";
import { getWorkerOrders } from "@/lib/orders/queries";
import { WorkerOrdersView } from "./components/WorkerOrdersView";

export default async function WorkerPage() {
  const t = await getT();
  const employee = await requireRole("worker");
  const { open, recent } = await getWorkerOrders();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <AppHeader fullName={employee.fullName} roleLabel={t("roles.worker")} />
      <TelegramLinkCard />
      <WorkerOrdersView open={open} recent={recent} />
    </div>
  );
}
