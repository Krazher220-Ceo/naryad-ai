import Link from "next/link";
import { IssueOrderForm } from "@/components/master/IssueOrderForm";
import { IconChevronLeft } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { getIssueFormData, getRequest } from "@/lib/orders/queries";

// ?equipment=<id> приходит с QR-кода оборудования: форма откроется с уже выбранным оборудованием.
// ?request=<id> — наряд по попутной заявке исполнителя: описание берётся из заявки.
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
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:max-w-3xl">
        <Link href="/master" className="inline-flex min-h-touch-sm items-center gap-1 self-start text-lg font-semibold text-ink">
          <IconChevronLeft />
          {t("master.card.back")}
        </Link>
        <h1 className="text-2xl font-bold text-ink">{t("master.issue.title")}</h1>
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
