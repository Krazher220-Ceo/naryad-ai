import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { AppHeader } from "@/components/AppHeader";
import { getOrderDetails } from "@/lib/orders/queries";
import { Button, ErrorState } from "@/components/ui";
import { OrderDetailView } from "./components/OrderDetailView";

type OrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderPage({ params }: OrderPageProps) {
  const t = await getT();
  const { id } = await params;
  const employee = await requireRole("worker");
  const data = await getOrderDetails(id);

  if (!data) {
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        <AppHeader fullName={employee.fullName} roleLabel={t("roles.worker")} />
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

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <AppHeader fullName={employee.fullName} roleLabel={t("roles.worker")} />
      <OrderDetailView
        order={data.order}
        events={data.events}
        photos={data.photos}
        materials={data.materials}
        review={data.review}
      />
    </div>
  );
}
