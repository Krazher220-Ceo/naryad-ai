import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { formatDateTime, minutesLate } from "@/components/master/format";
import { OrderActions, type WorkerOption } from "@/components/master/OrderActions";
import { Card, ErrorState, IconChevronLeft, OverdueTag, PriorityBadge, StatusBadge } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { t, type MessageKey } from "@/lib/i18n";
import { getOrderDetails } from "@/lib/orders/queries";
import { RealtimeRefresh } from "@/lib/orders/RealtimeRefresh";
import { canReassign, masterActions } from "@/lib/orders/transitions";
import type { WorkerBoardStatus } from "@/lib/orders/types";
import { createClient } from "@/lib/supabase/server";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-base text-ink-muted">{label}</dt>
      <dd className="text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}

type PhotoItem = { id: string; url: string | null };

function PhotoGrid({ title, items }: { title: string; items: PhotoItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <ul className="grid grid-cols-3 gap-2">
        {items.map((p, i) =>
          p.url ? (
            <li key={p.id} className="aspect-square overflow-hidden rounded-xl border border-line bg-canvas">
              <a href={p.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- ссылка на закрытое хранилище временная, next/image тут не нужен */}
                <img src={p.url} alt={`${title} ${i + 1}`} className="size-full object-cover" />
              </a>
            </li>
          ) : null,
        )}
      </ul>
    </section>
  );
}

export default async function MasterOrderPage({ params }: PageProps<"/master/orders/[id]">) {
  const { id } = await params;
  const employee = await requireRole("master");

  // Неверный id (не uuid) база отвечает ошибкой: для мастера это то же «не найден».
  const details = await getOrderDetails(id).catch(() => null);

  const header = <AppHeader fullName={employee.fullName} roleLabel={t("roles.master")} />;
  const back = (
    <Link href="/master" className="inline-flex min-h-touch-sm items-center gap-1 self-start text-lg font-semibold text-ink">
      <IconChevronLeft />
      {t("master.card.back")}
    </Link>
  );

  if (!details) {
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        {header}
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4">
          {back}
          <ErrorState title={t("orders.errors.notFound")} text={t("master.card.back")} />
        </main>
      </div>
    );
  }

  const { order, events, photos, materials } = details;

  // Список исполнителей нужен только для переназначения.
  let workers: WorkerOption[] = [];
  if (canReassign(order.status)) {
    const supabase = await createClient();
    const { data } = await supabase.from("worker_board").select("*").order("full_name");
    workers = (data ?? []).flatMap((w) =>
      w.id
        ? [
            {
              id: w.id,
              fullName: w.full_name ?? "",
              state: w.board_status as WorkerBoardStatus,
              orderNumber: w.current_order_number,
              queueCount: w.queue_count,
            },
          ]
        : [],
    );
  }

  const hasBottomBar = masterActions(order.status).includes("close");
  const photosBefore = photos.filter((p) => p.kind === "before");
  const photosAfter = photos.filter((p) => p.kind === "after");

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <RealtimeRefresh />
      {header}
      <main
        className={`mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-4 lg:max-w-5xl ${hasBottomBar ? "pb-36" : "pb-8"}`}
      >
        {back}
        <h1 className="text-2xl font-bold text-ink">
          {t("orders.number")}
          {order.number}
        </h1>

        <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <PriorityBadge priority={order.priority} />
              <StatusBadge status={order.status} />
              {order.overdue && <OverdueTag minutesLate={minutesLate(order.due_at)} />}
            </div>

            <p className="text-xl font-semibold text-ink">{order.description}</p>

            <dl className="grid gap-3">
              <Row label={t("master.card.equipment")} value={order.equipment?.name ?? ""} />
              <Row label={t("master.card.section")} value={order.section?.name ?? ""} />
              <Row label={t("master.card.assignee")} value={order.assignee?.full_name ?? t("master.noAssignee")} />
              <Row label={t("master.due")} value={formatDateTime(order.due_at)} />
              <Row label={t("master.card.master")} value={order.master?.full_name ?? ""} />
              {order.fault && <Row label={t("master.card.fault")} value={`${order.fault.code} · ${order.fault.name}`} />}
              {order.work_done && <Row label={t("master.card.workDone")} value={order.work_done} />}
              {materials.length > 0 && (
                <Row
                  label={t("master.card.materials")}
                  value={materials.map((m) => `${m.material?.name ?? ""}: ${m.qty} ${m.material?.unit ?? ""}`).join("; ")}
                />
              )}
            </dl>

            <PhotoGrid title={t("master.card.photosBefore")} items={photosBefore} />
            <PhotoGrid title={t("master.card.photosAfter")} items={photosAfter} />
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <OrderActions
              orderId={order.id}
              status={order.status}
              priority={order.priority}
              assigneeId={order.assignee_id}
              workers={workers}
            />

            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-ink">{t("master.card.history")}</h2>
              <Card>
                {events.length === 0 ? (
                  <p className="text-base text-ink-muted">{t("master.card.noHistory")}</p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {events.map((e) => (
                      <li key={e.id} className="flex flex-col">
                        <span className="text-base text-ink-muted">
                          {formatDateTime(e.created_at)}
                          {e.actor?.full_name ? ` · ${e.actor.full_name}` : ""}
                        </span>
                        <span className="text-lg font-semibold text-ink">{t(`orders.event.${e.action}` as MessageKey)}</span>
                        {(e.reason || e.comment) && <span className="text-base text-ink">{e.reason ?? e.comment}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
