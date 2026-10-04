import { requireRole } from "@/lib/auth/session";
import { TelegramLinkCard } from "@/components/TelegramLinkCard";
import { getWorkerOrders } from "@/lib/orders/queries";
import { WorkerOrdersView } from "./components/WorkerOrdersView";

export default async function WorkerPage() {
  const employee = await requireRole("worker");
  const { open, recent } = await getWorkerOrders();

  return (
    <div className="flex flex-1 flex-col">
      <TelegramLinkCard />
      <WorkerOrdersView fullName={employee.fullName} open={open} recent={recent} />
    </div>
  );
}
