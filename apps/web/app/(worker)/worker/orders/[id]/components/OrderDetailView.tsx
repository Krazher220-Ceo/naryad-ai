"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, type MessageKey } from "@/lib/i18n";
import { RealtimeRefresh } from "@/lib/orders/RealtimeRefresh";
import { transitionOrder } from "@/lib/orders/actions";
import {
  workerActions,
  canComplete,
  REJECT_REASONS,
  PAUSE_REASONS,
} from "@/lib/orders/transitions";
import type { OrderDetails } from "@/lib/orders/queries";
import type { OrderAction, OrderStatus } from "@/lib/orders/types";
import {
  Button,
  Card,
  PriorityBadge,
  StatusBadge,
  OverdueTag,
  BottomActionBar,
  ConfirmSheet,
  ReasonPicker,
  isReasonValid,
  InlineNotice,
  Toast,
  IconChevronLeft,
  IconX,
  type NoticeTone,
  type ReasonValue,
} from "@/components/ui";
import { eventLabel } from "@/components/review/eventLabel";
import { ReviewReport } from "@/components/review/ReviewReport";
import { ReviewWaiting } from "@/components/review/ReviewPolling";
import { formatOrderTime, getOverdueMinutes } from "@/app/(worker)/worker/components/utils";

type OrderDetailViewProps = {
  order: OrderDetails["order"];
  events: OrderDetails["events"];
  photos: OrderDetails["photos"];
  materials: OrderDetails["materials"];
  review: OrderDetails["review"];
};

export function OrderDetailView({ order, events, photos, materials, review }: OrderDetailViewProps) {
  const router = useRouter();

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<NoticeTone>("success");

  // Подтверждение отклонения
  const [rejectSheetOpen, setRejectSheetOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<ReasonValue>({ code: "", text: "" });

  // Подтверждение паузы
  const [pauseSheetOpen, setPauseSheetOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<ReasonValue>({ code: "", text: "" });

  const [sheetLoading, setSheetLoading] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // Idempotency: сохранение clientActionId на попытку
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

  // Кнопки по статусу — ТОЛЬКО из workerActions(status) и canComplete(status)
  const allowedActions = workerActions(order.status);
  const isCompletable = canComplete(order.status);

  // Доступные фото
  const beforePhotos = photos.filter((p) => p.kind === "before" && p.url);
  const afterPhotos = photos.filter((p) => p.kind === "after" && p.url);

  // Выполнение действия перехода
  async function handleAction(action: OrderAction) {
    const actionKey = `${order.id}-${action}`;
    setLoadingAction(action);
    const clientActionId = getClientActionId(actionKey);

    try {
      const res = await transitionOrder({
        orderId: order.id,
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
    if (!isReasonValid(rejectReason)) return;
    const actionKey = `${order.id}-reject`;
    setSheetLoading(true);
    const clientActionId = getClientActionId(actionKey);

    try {
      const res = await transitionOrder({
        orderId: order.id,
        action: "reject",
        reasonCode: rejectReason.code || undefined,
        reason: rejectReason.code === "other" ? rejectReason.text.trim() : undefined,
        clientActionId,
      });

      if (res.ok) {
        clearClientActionId(actionKey);
        setRejectSheetOpen(false);
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
    if (!isReasonValid(pauseReason)) return;
    const actionKey = `${order.id}-pause`;
    setSheetLoading(true);
    const clientActionId = getClientActionId(actionKey);

    try {
      const res = await transitionOrder({
        orderId: order.id,
        action: "pause",
        reasonCode: pauseReason.code || undefined,
        reason: pauseReason.code === "other" ? pauseReason.text.trim() : undefined,
        clientActionId,
      });

      if (res.ok) {
        clearClientActionId(actionKey);
        setPauseSheetOpen(false);
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

  // Уведомление о финальном / закрытом статусе
  function getStatusNotice(status: OrderStatus) {
    if (status === "done" || status === "ai_review") {
      return { tone: "info" as NoticeTone, text: t("worker.statusNotice.ai_review") };
    }
    if (status === "closed") {
      return { tone: "success" as NoticeTone, text: t("worker.statusNotice.closed") };
    }
    if (status === "rejected") {
      return { tone: "danger" as NoticeTone, text: t("worker.statusNotice.rejected") };
    }
    if (status === "cancelled") {
      return { tone: "offline" as NoticeTone, text: t("worker.statusNotice.cancelled") };
    }
    return null;
  }

  const statusNotice = getStatusNotice(order.status);
  const hasBottomActions = isCompletable || allowedActions.length > 0;

  return (
    <>
      <RealtimeRefresh />

      <Toast
        open={Boolean(toastMessage)}
        tone={toastTone}
        message={toastMessage ?? ""}
        onClose={() => setToastMessage(null)}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-4 pb-44">
        {/* Шапка карточки: кнопка назад и номер наряда */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/worker">
            <Button
              variant="secondary"
              size="md"
              icon={<IconChevronLeft className="size-5" />}
              className="px-3"
            >
              {t("worker.back")}
            </Button>
          </Link>
          <span className="text-xl font-bold text-ink">
            {t("orders.number")}{order.number}
          </span>
        </div>

        {/* Бейджи */}
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={order.priority} />
          <StatusBadge status={order.status} />
          <OverdueTag minutesLate={getOverdueMinutes(order)} />
        </div>

        {/* Уведомление для неактивных статусов */}
        {statusNotice && (
          <InlineNotice tone={statusNotice.tone}>
            {statusNotice.text}
          </InlineNotice>
        )}

        {/* Отчёт ИИ: оценка и что улучшить */}
        {review && ["ai_review", "rework", "closed"].includes(order.status) && (
          <ReviewReport review={review} mode="worker" />
        )}
        {!review && order.status === "ai_review" && <ReviewWaiting />}

        {/* Двухколоночная раскладка на ноутбуке (md+) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Левая колонка: Описание, детали, фото, материалы */}
          <div className="flex flex-col gap-6">
            {/* Описание и параметры */}
            <Card tone={order.priority === "emergency" ? "emergency" : "default"}>
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-bold leading-snug text-ink">
                    {order.description}
                  </h2>
                  {order.comment && (
                    <p className="mt-1 text-base text-ink-muted">{order.comment}</p>
                  )}
                </div>

                <dl className="grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-base text-ink-muted">{t("worker.equipment")}</dt>
                    <dd className="text-base font-semibold text-ink">
                      {order.equipment?.name ?? "—"}
                      {order.equipment?.inventory_no && (
                        <span className="ml-1 text-ink-muted">
                          ({order.equipment.inventory_no})
                        </span>
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-base text-ink-muted">{t("worker.section")}</dt>
                    <dd className="text-base font-semibold text-ink">
                      {order.section?.name ?? "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-base text-ink-muted">{t("worker.due")}</dt>
                    <dd className="text-base font-semibold text-ink">
                      {formatOrderTime(order.due_at)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-base text-ink-muted">{t("worker.master")}</dt>
                    <dd className="text-base font-semibold text-ink">
                      {order.master?.full_name ?? "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </Card>

            {/* Фото «до» (блок скрыт, если фото нет) */}
            {beforePhotos.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-lg font-bold text-ink">{t("worker.beforePhotos")}</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {beforePhotos.map((photo, i) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => photo.url && setFullscreenPhoto(photo.url)}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-canvas focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url!}
                        alt={`${t("worker.beforePhotos")} ${i + 1}`}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Фото «после» (если уже загружены) */}
            {afterPhotos.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-lg font-bold text-ink">{t("worker.afterPhotos")}</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {afterPhotos.map((photo, i) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => photo.url && setFullscreenPhoto(photo.url)}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-canvas focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url!}
                        alt={`${t("worker.afterPhotos")} ${i + 1}`}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Материалы */}
            {materials.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-lg font-bold text-ink">{t("worker.materialsUsed")}</h3>
                <ul className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-3">
                  {materials.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-base">
                      <span className="text-ink">{m.material?.name ?? "—"}</span>
                      <span className="font-semibold text-ink">
                        {m.qty} {m.material?.unit ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Правая колонка: История событий */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold text-ink">{t("worker.history")}</h3>
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
              {events.map((event, i) => {
                const reasonLabel = event.reason_code
                  ? t(`orders.reasons.${event.reason_code}` as MessageKey)
                  : "";
                const reasonText = event.reason
                  ? reasonLabel
                    ? `${reasonLabel}: ${event.reason}`
                    : event.reason
                  : reasonLabel;

                return (
                  <div
                    key={event.id}
                    className={`flex flex-col gap-1 ${
                      i > 0 ? "border-t border-line/60 pt-3" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold text-ink">
                        {eventLabel(event.action)}
                      </span>
                      <span className="shrink-0 text-sm text-ink-muted">
                        {formatOrderTime(event.created_at)}
                      </span>
                    </div>

                    {event.actor?.full_name && (
                      <p className="text-sm text-ink-muted">{event.actor.full_name}</p>
                    )}

                    {reasonText && (
                      <p className="rounded-lg bg-danger-soft px-2 py-1 text-sm font-semibold text-danger">
                        {t("ui.reason.title")}: {reasonText}
                      </p>
                    )}

                    {event.comment && (
                      <p className="text-sm italic text-ink-muted">«{event.comment}»</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Панель действий внизу экрана */}
      {hasBottomActions && (
        <BottomActionBar>
          {/* Главное действие (primary, 56 px) */}
          {isCompletable && (
            <Link href={`/worker/orders/${order.id}/close`} className="w-full">
              <Button fullWidth variant="primary" size="lg">
                {t("orders.action.complete")}
              </Button>
            </Link>
          )}

          {!isCompletable && allowedActions.includes("accept") && (
            <Button
              fullWidth
              variant="primary"
              size="lg"
              loading={loadingAction === "accept"}
              onClick={() => handleAction("accept")}
            >
              {t("orders.action.accept")}
            </Button>
          )}

          {!isCompletable && allowedActions.includes("start") && (
            <Button
              fullWidth
              variant="primary"
              size="lg"
              loading={loadingAction === "start"}
              onClick={() => handleAction("start")}
            >
              {t("orders.action.start")}
            </Button>
          )}

          {!isCompletable && allowedActions.includes("resume") && (
            <Button
              fullWidth
              variant="primary"
              size="lg"
              loading={loadingAction === "resume"}
              onClick={() => handleAction("resume")}
            >
              {t("orders.action.resume")}
            </Button>
          )}

          {/* Вторичное действие (secondary, 48 px) */}
          {allowedActions.includes("queue") && (
            <Button
              fullWidth
              variant="secondary"
              size="md"
              loading={loadingAction === "queue"}
              onClick={() => handleAction("queue")}
            >
              {t("orders.action.queue")}
            </Button>
          )}

          {/* Опасные действия: отклонить или приостановить (отдельно через отступ) */}
          {allowedActions.includes("reject") && (
            <Button
              fullWidth
              variant="ghost"
              size="md"
              className="mt-1 text-danger hover:text-danger-hover"
              onClick={() => {
                setRejectSheetOpen(true);
                setRejectReason({ code: "", text: "" });
              }}
            >
              {t("orders.action.reject")}
            </Button>
          )}

          {allowedActions.includes("pause") && (
            <Button
              fullWidth
              variant="ghost"
              size="md"
              className="mt-1 text-danger hover:text-danger-hover"
              onClick={() => {
                setPauseSheetOpen(true);
                setPauseReason({ code: "", text: "" });
              }}
            >
              {t("orders.action.pause")}
            </Button>
          )}
        </BottomActionBar>
      )}

      {/* ConfirmSheet для отклонения наряда */}
      <ConfirmSheet
        open={rejectSheetOpen}
        tone="danger"
        title={t("worker.rejectSheetTitle").replace("{number}", String(order.number))}
        description={t("worker.rejectSheetDescription")}
        confirmLabel={t("orders.action.reject")}
        confirmDisabled={!isReasonValid(rejectReason)}
        loading={sheetLoading}
        onConfirm={confirmReject}
        onCancel={() => {
          setRejectSheetOpen(false);
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
        open={pauseSheetOpen}
        tone="danger"
        title={t("worker.pauseSheetTitle").replace("{number}", String(order.number))}
        description={t("worker.pauseSheetDescription")}
        confirmLabel={t("orders.action.pause")}
        confirmDisabled={!isReasonValid(pauseReason)}
        loading={sheetLoading}
        onConfirm={confirmPause}
        onCancel={() => {
          setPauseSheetOpen(false);
          setPauseReason({ code: "", text: "" });
        }}
      >
        <ReasonPicker
          codes={PAUSE_REASONS}
          value={pauseReason}
          onChange={setPauseReason}
        />
      </ConfirmSheet>

      {/* Модальное окно просмотра фото во весь экран */}
      {fullscreenPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button
            type="button"
            onClick={() => setFullscreenPhoto(null)}
            aria-label={t("ui.action.close")}
            className="absolute right-4 top-4 flex size-touch-sm items-center justify-center rounded-full bg-surface/20 text-white hover:bg-surface/30 active:bg-surface/40"
          >
            <IconX className="size-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreenPhoto}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}
