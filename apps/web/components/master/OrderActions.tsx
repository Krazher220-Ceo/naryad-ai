"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BottomActionBar,
  Button,
  Card,
  ConfirmSheet,
  Field,
  InlineNotice,
  PRIORITIES,
  SegmentedControl,
  TextArea,
  WorkerChip,
  cx,
} from "@/components/ui";
import { t } from "@/lib/i18n";
import { changeOrderPriority, reassignOrder, transitionOrder, type TransitionInput } from "@/lib/orders/actions";
import { canReassign, masterActions } from "@/lib/orders/transitions";
import type { ActionResult, MasterAction, OrderPriority, OrderStatus, WorkerBoardStatus } from "@/lib/orders/types";

export type WorkerOption = {
  id: string;
  fullName: string;
  state: WorkerBoardStatus;
  orderNumber: number | null;
  queueCount: number | null;
};

type Sheet = MasterAction | "reassign" | "priority" | null;

type Props = {
  orderId: string;
  status: OrderStatus;
  priority: OrderPriority;
  assigneeId: string | null;
  workers: WorkerOption[];
};

export function OrderActions({ orderId, status, priority, assigneeId, workers }: Props) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reason, setReason] = useState("");
  const [newAssignee, setNewAssignee] = useState<string | null>(assigneeId);
  const [newPriority, setNewPriority] = useState<OrderPriority>(priority);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Один id на попытку: повтор после ошибки не задвоит действие.
  const actionId = useRef<string | null>(null);

  const actions = masterActions(status);
  const closed = status === "closed" || status === "cancelled";
  const needsReason = sheet === "rework" || sheet === "cancel";

  function open(next: Sheet) {
    setError(null);
    setReason("");
    setNewAssignee(assigneeId);
    setNewPriority(priority);
    actionId.current = null;
    setSheet(next);
  }

  async function confirm() {
    if (!sheet) return;
    actionId.current ??= crypto.randomUUID();
    const clientActionId = actionId.current;
    setLoading(true);
    setError(null);

    let result: ActionResult<unknown>;
    if (sheet === "reassign") {
      result = await reassignOrder({ orderId, assigneeId: newAssignee ?? undefined, clientActionId });
    } else if (sheet === "priority") {
      result = await changeOrderPriority({ orderId, priority: newPriority, clientActionId });
    } else {
      const input: TransitionInput = { orderId, action: sheet, clientActionId };
      if (needsReason) input.reason = reason.trim();
      result = await transitionOrder(input);
    }
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    actionId.current = null;
    setSheet(null);
    router.refresh();
  }

  const sheetTitle = sheet === "reassign" ? t("orders.action.reassign") : sheet === "priority" ? t("orders.action.changePriority") : sheet ? t(`orders.action.${sheet}`) : "";
  const sheetText: Record<NonNullable<Sheet>, string> = {
    close: t("master.card.closeText"),
    rework: t("master.card.reworkText"),
    cancel: t("master.card.cancelText"),
    reassign: t("master.card.reassignText"),
    priority: t("master.card.priorityText"),
  };

  return (
    <>
      {actions.includes("close") && (
        <BottomActionBar>
          <Button fullWidth onClick={() => open("close")}>
            {t("orders.action.close")}
          </Button>
        </BottomActionBar>
      )}

      {!closed && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-ink">{t("master.card.actions")}</h2>
          {canReassign(status) && (
            <Button variant="secondary" size="md" onClick={() => open("reassign")}>
              {t("orders.action.reassign")}
            </Button>
          )}
          <Button variant="secondary" size="md" onClick={() => open("priority")}>
            {t("orders.action.changePriority")}
          </Button>
          {actions.includes("rework") && (
            <Button variant="secondary" size="md" onClick={() => open("rework")}>
              {t("orders.action.rework")}
            </Button>
          )}
          {actions.includes("cancel") && (
            <Button variant="ghost" size="md" className="text-danger" onClick={() => open("cancel")}>
              {t("orders.action.cancel")}
            </Button>
          )}
        </Card>
      )}

      <ConfirmSheet
        open={sheet !== null}
        title={sheetTitle}
        description={sheet ? sheetText[sheet] : undefined}
        confirmLabel={sheet === "reassign" || sheet === "priority" ? t("master.card.save") : sheetTitle}
        tone={sheet === "cancel" ? "danger" : "primary"}
        confirmDisabled={(needsReason && reason.trim().length === 0) || (sheet === "reassign" && !newAssignee)}
        loading={loading}
        onConfirm={confirm}
        onCancel={() => setSheet(null)}
      >
        {needsReason && (
          <Field label={t("master.card.reason")} htmlFor="order-reason" required>
            <TextArea
              id="order-reason"
              value={reason}
              placeholder={t("master.card.reasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        )}
        {sheet === "reassign" && (
          <ul className="flex flex-col gap-2">
            {workers.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  aria-pressed={w.id === newAssignee}
                  onClick={() => setNewAssignee(w.id)}
                  className={cx("block w-full rounded-xl text-left", w.id === newAssignee && "ring-4 ring-brand")}
                >
                  <WorkerChip
                    name={w.fullName}
                    state={w.state}
                    orderNumber={w.orderNumber ?? undefined}
                    queueCount={w.queueCount ?? undefined}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
        {sheet === "priority" && (
          <SegmentedControl
            ariaLabel={t("orders.action.changePriority")}
            value={newPriority}
            onChange={setNewPriority}
            options={PRIORITIES.map((p) => ({
              value: p,
              label: t(`orders.priority.${p}`),
              tone: p === "emergency" ? "danger" : "default",
            }))}
          />
        )}
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      </ConfirmSheet>
    </>
  );
}
