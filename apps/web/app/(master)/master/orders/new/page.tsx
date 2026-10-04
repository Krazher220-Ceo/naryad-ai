import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { IssueOrderForm } from "@/components/master/IssueOrderForm";
import { IconChevronLeft } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { getIssueFormData } from "@/lib/orders/queries";

// ?equipment=<id> приходит с QR-кода оборудования: форма откроется с уже выбранным оборудованием.
export default async function NewOrderPage({ searchParams }: PageProps<"/master/orders/new">) {
  const t = await getT();
  const { equipment } = await searchParams;
  const employee = await requireRole("master");
  const data = await getIssueFormData();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <AppHeader fullName={employee.fullName} roleLabel={t("roles.master")} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:max-w-3xl">
        <Link href="/master" className="inline-flex min-h-touch-sm items-center gap-1 self-start text-lg font-semibold text-ink">
          <IconChevronLeft />
          {t("master.card.back")}
        </Link>
        <h1 className="text-2xl font-bold text-ink">{t("master.issue.title")}</h1>
        <IssueOrderForm
          data={data}
          employeeId={employee.id}
          initialEquipmentId={typeof equipment === "string" && data.equipment.some((e) => e.id === equipment) ? equipment : null}
        />
      </main>
    </div>
  );
}
