// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import Link from "next/link";
import { IssueOrderForm } from "@/components/master/IssueOrderForm";
import { IconChevronLeft, InlineNotice } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { getIssueFormData, getRequest } from "@/lib/orders/queries";

// ?equipment=<id> приходит с QR-кода оборудования: форма откроется с уже выбранным оборудованием.
// ?request=<id> — наряд по заявке оператора или попутной находке исполнителя: описание и машина из заявки.
export default async function NewOrderPage({ searchParams }: PageProps<"/master/orders/new">) {
  const t = await getT();
  const { equipment, request } = await searchParams;
  const employee = await requireRole("master");
  const [data, fromRequest] = await Promise.all([
    getIssueFormData(),
    typeof request === "string" ? getRequest(request) : Promise.resolve(null),
  ]);
  const equipmentId = fromRequest?.equipment_id ?? (typeof equipment === "string" ? equipment : null);

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:h-dvh lg:flex-none lg:max-w-none lg:gap-2 lg:px-6 lg:py-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <Link href="/master" className="hidden min-h-touch-sm items-center gap-1 self-start text-lg font-semibold text-ink lg:inline-flex">
            <IconChevronLeft />
            {t("master.card.back")}
          </Link>
          <h1 className="text-2xl font-bold text-ink lg:text-xl">{t("master.issue.title")}</h1>
        </div>
        {fromRequest && <InlineNotice>{t("requests.fromRequest").replace("{n}", String(fromRequest.number))}</InlineNotice>}
        <IssueOrderForm
          data={data}
          employeeId={employee.id}
          initialEquipmentId={equipmentId && data.equipment.some((e) => e.id === equipmentId) ? equipmentId : null}
          initialDescription={fromRequest?.description ?? ""}
          requestId={fromRequest?.id}
        />
      </main>
    </div>
  );
}
