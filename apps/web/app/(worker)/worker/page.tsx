// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { requireRole } from "@/lib/auth/session";
import { Suspense } from "react";
import { TelegramLinkCard } from "@/components/TelegramLinkCard";
import { getWorkerOrders } from "@/lib/orders/queries";
import { WorkerOrdersView } from "./components/WorkerOrdersView";

export default async function WorkerPage() {
  const employee = await requireRole("worker");
  const { open, recent } = await getWorkerOrders();

  return (
    <div className="flex flex-1 flex-col">
      {/* Карточка догружается потоком и не задерживает основной экран */}
      <Suspense fallback={null}>
        <TelegramLinkCard />
      </Suspense>
      <WorkerOrdersView fullName={employee.fullName} open={open} recent={recent} />
    </div>
  );
}
