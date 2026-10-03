"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { RealtimeRefresh } from "@/lib/orders/RealtimeRefresh";
import { transitionOrder } from "@/lib/orders/actions";
import {
  REJECT_REASONS,
  PAUSE_REASONS,
} from "@/lib/orders/transitions";
import type { WorkerOrders } from "@/lib/orders/queries";
import type { OrderAction } from "@/lib/orders/types";
import {
  Button,
  Card,
  ListItem,
  PriorityBadge,
  StatusBadge,
  OverdueTag,
  ConfirmSheet,
  ReasonPicker,
  isReasonValid,
  EmptyState,
  Toast,
  type NoticeTone,
  type ReasonValue,
} from "@/components/ui";
import { formatOrderTime, getOverdueMinutes } from "./utils";

type WorkerOrdersViewProps = {
  open: WorkerOrders["open"];
  recent: WorkerOrders["recent"];
};

type OrderItem = WorkerOrders["open"][number];

export function WorkerOrdersView({ open, recent }: WorkerOrdersViewProps) {
  const router = useRouter();

  // Состояния действий
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<NoticeTone>("success");

  // Отклонение наряда (ConfirmSheet)
  const [rejectingOrder, setRejectingOrder] = useState<OrderItem | null>(null);
  const [rejectReason, setRejectReason] = useState<ReasonValue>({ code: "", text: "" });

  // Приостановка наряда (ConfirmSheet)
  const [pausingOrder, setPausingOrder] = useState<OrderItem | null>(null);
  const [pauseReason, setPauseReason] = useState<ReasonValue>({ code: "", text: "" });

  const [sheetLoading, setSheetLoading] = useState(false);
  const [showDone, setShowDone] = useState(false);

  // Сохранение clientActionId для защиты от дублей при повторах
  const clientActionIds = useRef<Record<string, string>>({});

  function getClientActionId(key: string): string {
    if (!clientActionIds.current[key]) {
      clientActionIds.current[key] = crypto.randomUUID();
    }
    return clientActionIds.current[key];
  }

  function clearClientActionId(key: string) {
    delete clientActionIds.current[key];
  }

  // Распределение нарядов по категориям:
  // 1. Новые (issued) — ждут принятия, карточками наверху
  const issuedOrders = open.filter((o) => o.status === "issued");

  // 2. «Сейчас» — в работе или на паузе (или принят/на доработке перед началом)
  const nowOrders = open.filter((o) =>
    ["in_progress", "paused", "accepted", "rework"].includes(o.status),
  );
  const currentOrder = nowOrders[0] ?? null;

  // 3. «Очередь» — в очереди (или остальные открытые, не попавшие в «Сейчас» и «Новые»)
  const queuedOrders = open.filter(
    (o) =>
      o.status === "queued" ||
      (!issuedOrders.some((io) => io.id === o.id) &&
        (!currentOrder || currentOrder.id !== o.id) &&
        !["done", "ai_review"].includes(o.status)),
  );

  // 4. «Сделано сегодня» — исполнено, на проверке ИИ, закрыто, отменено
  const doneOpenOrders = open.filter((o) => ["done", "ai_review"].includes(o.status));
  const doneOrders = [...doneOpenOrders, ...recent];

  const isEmpty = open.length === 0 && recent.length === 0;

  // Обработка перехода статуса
  async function handleAction(orderId: string, action: OrderAction) {
    const actionKey = `${orderId}-${action}`;
    setLoadingAction(actionKey);
    const clientActionId = getClientActionId(actionKey);

    try {
      const res = await transitionOrder({
        orderId,
        action,
        clientActionId,
      });

      if (res.ok) {
        clearClientActionId(actionKey);
        router.refresh();
      } else {
        setToastMessage(res.error);
        setToastTone("danger");
      }
    } catch {
      setToastMessage(t("orders.errors.unknown"));
      setToastTone("danger");
    } finally {
      setLoadingAction(null);
    }
  }

  // Подтверждение отклонения
  async function confirmReject() {
    if (!rejectingOrder || !isReasonValid(rejectReason)) return;
    const actionKey = `${rejectingOrder.id}-reject`;
    setSheetLoading(true);
    const clientActionId = getClientActionId(actionKey);

    try {
      const res = await transitionOrder({
        orderId: rejectingOrder.id,
        action: "reject",
        reasonCode: rejectReason.code || undefined,
        reason: rejectReason.code === "other" ? rejectReason.text.trim() : undefined,
        clientActionId,
      });

      if (res.ok) {
        clearClientActionId(actionKey);
        setRejectingOrder(null);
        setRejectReason({ code: "", text: "" });
        router.refresh();
      } else {
        setToastMessage(res.error);
        setToastTone("danger");
      }
    } catch {
      setToastMessage(t("orders.errors.unknown"));
      setToastTone("danger");
    } finally {
      setSheetLoading(false);
    }
  }

  // Подтверждение паузы
  async function confirmPause() {
    if (!pausingOrder || !isReasonValid(pauseReason)) return;
    const actionKey = `${pausingOrder.id}-pause`;
    setSheetLoading(true);
    const clientActionId = getClientActionId(actionKey);

    try {
      const res = await transitionOrder({
        orderId: pausingOrder.id,
        action: "pause",
        reasonCode: pauseReason.code || undefined,
        reason: pauseReason.code === "other" ? pauseReason.text.trim() : undefined,
        clientActionId,
      });

      if (res.ok) {
        clearClientActionId(actionKey);
        setPausingOrder(null);
        setPauseReason({ code: "", text: "" });
        router.refresh();
      } else {
        setToastMessage(res.error);
        setToastTone("danger");
      }
    } catch {
      setToastMessage(t("orders.errors.unknown"));
      setToastTone("danger");
    } finally {
      setSheetLoading(false);
    }
  }

  return (
    <>
      <RealtimeRefresh />

      <Toast
        open={Boolean(toastMessage)}
        tone={toastTone}
        message={toastMessage ?? ""}
        onClose={() => setToastMessage(null)}
      />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-4 pb-36">
        <h1 className="text-2xl font-bold text-ink">{t("worker.myOrders")}</h1>

        {isEmpty ? (
          <EmptyState
            title={t("ui.empty.ordersTitle")}
            text={t("ui.empty.ordersText")}
          />
        ) : (
          <>
            {/* 1. Новые наряды (issued) */}
            {issuedOrders.map((order) => (
              <Card
                key={order.id}
                tone={order.priority === "emergency" ? "emergency" : "default"}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={order.priority} />
                      <StatusBadge status={order.status} />
                      <OverdueTag minutesLate={getOverdueMinutes(order)} />
                    </div>
                    <span className="shrink-0 text-base font-semibold text-ink">
                      №{order.number} · {formatOrderTime(order.due_at)}
                    </span>
                  </div>

                  <Link
                    href={`/worker/orders/${order.id}`}
                    className="block group"
                  >
                    <p className="text-xl font-bold text-ink group-hover:underline">
                      {order.description}
                    </p>
                  </Link>

                  <p className="text-base text-ink-muted">
                    {[order.equipment?.name, order.section?.name].filter(Boolean).join(" · ")}
                  </p>

                  <div className="mt-2 flex flex-col gap-2">
                    <Button
                      fullWidth
                      variant="primary"
                      size="lg"
                      loading={loadingAction === `${order.id}-accept`}
                      onClick={() => handleAction(order.id, "accept")}
                    >
                      {t("orders.action.accept")}
                    </Button>
                    <Button
                      fullWidth
                      variant="secondary"
                      size="md"
                      loading={loadingAction === `${order.id}-queue`}
                      onClick={() => handleAction(order.id, "queue")}
                    >
                      {t("orders.action.queue")}
                    </Button>
                    <Button
                      fullWidth
                      variant="ghost"
                      size="md"
                      className="text-danger hover:text-danger-hover"
                      onClick={() => {
                        setRejectingOrder(order);
                        setRejectReason({ code: "", text: "" });
                      }}
                    >
                      {t("orders.action.reject")}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {/* 2. «Сейчас» */}
            {currentOrder && (
              <section className="flex flex-col gap-2">
                <h2 className="text-xl font-bold text-ink">{t("worker.now")}</h2>
                <Card tone={currentOrder.priority === "emergency" ? "emergency" : "default"}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={currentOrder.priority} />
                        <StatusBadge status={currentOrder.status} />
                        <OverdueTag minutesLate={getOverdueMinutes(currentOrder)} />
                      </div>
                      <span className="shrink-0 text-base font-semibold text-ink">
                        №{currentOrder.number} · {formatOrderTime(currentOrder.due_at)}
                      </span>
                    </div>

                    <Link
                      href={`/worker/orders/${currentOrder.id}`}
                      className="block group"
                    >
                      <p className="text-xl font-bold text-ink group-hover:underline">
                        {currentOrder.description}
                      </p>
                    </Link>

                    <p className="text-base text-ink-muted">
                      {[currentOrder.equipment?.name, currentOrder.section?.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    <div className="mt-2 flex flex-col gap-2">
                      {currentOrder.status === "in_progress" && (
                        <>
                          <Link href={`/worker/orders/${currentOrder.id}/close`}>
                            <Button fullWidth variant="primary" size="lg">
                              {t("orders.action.complete")}
                            </Button>
                          </Link>
                          <Button
                            fullWidth
                            variant="ghost"
                            size="md"
                            className="text-danger hover:text-danger-hover"
                            onClick={() => {
                              setPausingOrder(currentOrder);
                              setPauseReason({ code: "", text: "" });
                            }}
                          >
                            {t("orders.action.pause")}
                          </Button>
                        </>
                      )}

                      {currentOrder.status === "paused" && (
                        <Button
                          fullWidth
                          variant="primary"
                          size="lg"
                          loading={loadingAction === `${currentOrder.id}-resume`}
                          onClick={() => handleAction(currentOrder.id, "resume")}
                        >
                          {t("orders.action.resume")}
                        </Button>
                      )}

                      {(currentOrder.status === "accepted" ||
                        currentOrder.status === "rework") && (
                        <Button
                          fullWidth
                          variant="primary"
                          size="lg"
                          loading={loadingAction === `${currentOrder.id}-start`}
                          onClick={() => handleAction(currentOrder.id, "start")}
                        >
                          {t("orders.action.start")}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </section>
            )}

            {/* 3. «Очередь» */}
            {queuedOrders.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-ink">
                  {t("worker.queueCount").replace("{count}", String(queuedOrders.length))}
                </h2>
                <div className="flex flex-col gap-2">
                  {queuedOrders.map((order) => (
                    <ListItem
                      key={order.id}
                      href={`/worker/orders/${order.id}`}
                      tone={order.priority === "emergency" ? "emergency" : "default"}
                      title={order.description}
                      subtitle={[order.equipment?.name, order.section?.name]
                        .filter(Boolean)
                        .join(" · ")}
                      meta={`№${order.number} · ${formatOrderTime(order.due_at)}`}
                      badges={
                        <>
                          <PriorityBadge priority={order.priority} />
                          <StatusBadge status={order.status} />
                          <OverdueTag minutesLate={getOverdueMinutes(order)} />
                        </>
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 4. «Сделано сегодня» */}
            {doneOrders.length > 0 && (
              <section className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setShowDone(!showDone)}
                  className="flex items-center justify-between py-2 text-left"
                >
                  <h2 className="text-xl font-bold text-ink">
                    {t("worker.doneTodayCount").replace("{count}", String(doneOrders.length))}
                  </h2>
                  <span className="text-base font-semibold text-accent-ink underline">
                    {showDone ? t("worker.hideDone") : t("worker.showDone")}
                  </span>
                </button>

                {showDone && (
                  <div className="flex flex-col gap-2">
                    {doneOrders.map((order) => (
                      <ListItem
                        key={order.id}
                        href={`/worker/orders/${order.id}`}
                        title={order.description}
                        subtitle={[order.equipment?.name, order.section?.name]
                          .filter(Boolean)
                          .join(" · ")}
                        meta={`№${order.number} · ${formatOrderTime(order.due_at)}`}
                        badges={
                          <>
                            <PriorityBadge priority={order.priority} />
                            <StatusBadge status={order.status} />
                          </>
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* ConfirmSheet для отклонения наряда */}
      <ConfirmSheet
        open={Boolean(rejectingOrder)}
        tone="danger"
        title={t("worker.rejectSheetTitle").replace(
          "{number}",
          String(rejectingOrder?.number ?? ""),
        )}
        description={t("worker.rejectSheetDescription")}
        confirmLabel={t("orders.action.reject")}
        confirmDisabled={!isReasonValid(rejectReason)}
        loading={sheetLoading}
        onConfirm={confirmReject}
        onCancel={() => {
          setRejectingOrder(null);
          setRejectReason({ code: "", text: "" });
        }}
      >
        <ReasonPicker
          codes={REJECT_REASONS}
          value={rejectReason}
          onChange={setRejectReason}
        />
      </ConfirmSheet>

      {/* ConfirmSheet для приостановки наряда */}
      <ConfirmSheet
        open={Boolean(pausingOrder)}
        tone="danger"
        title={t("worker.pauseSheetTitle").replace(
          "{number}",
          String(pausingOrder?.number ?? ""),
        )}
        description={t("worker.pauseSheetDescription")}
        confirmLabel={t("orders.action.pause")}
        confirmDisabled={!isReasonValid(pauseReason)}
        loading={sheetLoading}
        onConfirm={confirmPause}
        onCancel={() => {
          setPausingOrder(null);
          setPauseReason({ code: "", text: "" });
        }}
      >
        <ReasonPicker
          codes={PAUSE_REASONS}
          value={pauseReason}
          onChange={setPauseReason}
        />
      </ConfirmSheet>
    </>
  );
}
