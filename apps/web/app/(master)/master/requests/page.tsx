// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { SideRequests } from "@/components/master/SideRequests";
import { getT } from "@/lib/i18n-server";
import { getMasterBoard } from "@/lib/orders/queries";
import { RealtimeRefresh } from "@/lib/orders/RealtimeRefresh";

// Все заявки, которые ждут мастера: операторов по QR и попутные находки исполнителей.
export default async function MasterRequestsPage() {
  const t = await getT();
  const { requests } = await getMasterBoard();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:max-w-6xl lg:py-8">
      <RealtimeRefresh />
      <h1 className="hidden text-3xl font-semibold text-ink lg:block">{t("requests.title")}</h1>
      <SideRequests requests={requests} showEmpty />
    </main>
  );
}
