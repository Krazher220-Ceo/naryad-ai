import { requireRole } from "@/lib/auth/session";
import { TelegramLinkCard } from "@/components/TelegramLinkCard";
import { getWorkerOrders } from "@/lib/orders/queries";
import { WorkerOrdersView } from "./components/WorkerOrdersView";

export default async function WorkerPage() {
  await requireRole("worker");
  const { open, recent } = await getWorkerOrders();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <TelegramLinkCard />
      <WorkerOrdersView open={open} recent={recent} />
    </div>
  );
}
