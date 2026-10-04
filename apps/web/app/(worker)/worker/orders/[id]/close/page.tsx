import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { getOrderDetails, getCloseFormData } from "@/lib/orders/queries";
import { canComplete } from "@/lib/orders/transitions";
import { Button, ErrorState } from "@/components/ui";
import { OrderCloseView } from "./components/OrderCloseView";

type ClosePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClosePage({ params }: ClosePageProps) {
  const t = await getT();
  const { id } = await params;
  const employee = await requireRole("worker");

  const [details, formData] = await Promise.all([
    getOrderDetails(id),
    getCloseFormData(),
  ]);

  if (!details) {
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-4">
          <ErrorState title={t("orders.errors.notFound")} text="" />
          <Link href="/worker" className="w-full">
            <Button variant="secondary" fullWidth>
              {t("worker.back")}
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  // Закрыть наряд можно только в статусе in_progress
  if (!canComplete(details.order.status)) {
    redirect(`/worker/orders/${id}`);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <OrderCloseView
        order={details.order}
        faultCodes={formData.faultCodes}
        allMaterials={formData.materials}
        employee={employee}
        beforePhotoUrl={details.photos.find((p) => p.kind === "before" && p.url)?.url ?? null}
      />
    </div>
  );
}
