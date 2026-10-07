// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useEffect, useRef, useState } from "react";
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
import { useT } from "@/components/LocaleProvider";
import {
  changeOrderPriority,
  reassignOrder,
  rerunReview,
  setMasterScore,
  transitionOrder,
  type TransitionInput,
} from "@/lib/orders/actions";
import { canReassign, masterActions } from "@/lib/orders/transitions";
import type { ActionResult, MasterAction, OrderPriority, OrderStatus, WorkerBoardStatus } from "@/lib/orders/types";

export type WorkerOption = {
  id: string;
  fullName: string;
  state: WorkerBoardStatus;
  orderNumber: number | null;
  queueCount: number | null;
};

type Sheet = MasterAction | "reassign" | "priority" | "score" | null;

// Коротко о проверке ИИ: достаточно для кнопок, сам отчёт рисует ReviewReport.
export type ReviewSummary = {
  id: string;
  verdict: "accept" | "accept_with_note" | "rework" | "needs_master";
  score: number | null;
  improve: string[];
  hasErrors: boolean;
};

const SCORES = ["1", "2", "3", "4", "5"] as const;
type ScoreValue = (typeof SCORES)[number];

// Через сколько секунд без отчёта предлагаем запустить проверку заново.
const STALE_REVIEW_SECONDS = 30;

type Props = {
  orderId: string;
  status: OrderStatus;
  priority: OrderPriority;
  assigneeId: string | null;
  workers: WorkerOption[];
  review: ReviewSummary | null;
  // Когда наряд ушёл на проверку ИИ (ISO), нужно для «Проверить заново».
  reviewSince: string | null;
};

export function OrderActions({ orderId, status, priority, assigneeId, workers, review, reviewSince }: Props) {
  const t = useT();
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reason, setReason] = useState("");
  const [newAssignee, setNewAssignee] = useState<string | null>(assigneeId);
  const [newPriority, setNewPriority] = useState<OrderPriority>(priority);
  const [newScore, setNewScore] = useState<ScoreValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [reviewStale, setReviewStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Один id на попытку: повтор после ошибки не задвоит действие.
  const actionId = useRef<string | null>(null);

  // Отчёта нет дольше 30 секунд: что-то пошло не так, даём запустить заново.
  useEffect(() => {
    if (status !== "ai_review" || review || !reviewSince) return;
    const left = new Date(reviewSince).getTime() + STALE_REVIEW_SECONDS * 1000 - Date.now();
    const timer = setTimeout(() => setReviewStale(true), Math.max(left, 0));
    return () => clearTimeout(timer);
  }, [status, review, reviewSince]);

  const canRerun = status === "ai_review" && ((!review && reviewStale) || review?.hasErrors === true);

  const actions = masterActions(status);
  const closed = status === "closed" || status === "cancelled";
  const needsReason = sheet === "rework" || sheet === "cancel" || sheet === "score";

  function open(next: Sheet) {
    setError(null);
    setReason("");
    setNewAssignee(assigneeId);
    setNewPriority(priority);
    setNewScore(review?.score ? (String(review.score) as ScoreValue) : null);
    actionId.current = null;
    // Причину доработки подставляем из замечаний ИИ, мастер может её поправить.
    if (next === "rework" && review?.verdict === "rework" && review.improve.length > 0) {
      setReason(review.improve.join("; "));
    }
    setSheet(next);
  }

  async function confirm() {
    if (!sheet) return;
    actionId.current ??= crypto.randomUUID();
    const clientActionId = actionId.current;
    setLoading(true);
    setError(null);

    let result: ActionResult<unknown>;
    if (sheet === "score") {
      result = review && newScore
        ? await setMasterScore({ reviewId: review.id, score: Number(newScore), reason: reason.trim() })
        : { ok: false, error: t("orders.errors.unknown") };
    } else if (sheet === "reassign") {
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
    if (sheet === "score") setNotice({ tone: "success", text: t("review.action.scoreSaved") });
    // Экран обновляет само серверное действие (refresh в lib/orders/actions.ts).
    setSheet(null);
  }

  async function rerun() {
    setRerunning(true);
    setNotice(null);
    const result = await rerunReview(orderId);
    setRerunning(false);
    setNotice(result.ok ? { tone: "success", text: t("review.action.rerunStarted") } : { tone: "danger", text: result.error });
    if (result.ok) {
      setReviewStale(false);
      router.refresh();
    }
  }

  const sheetTitle = sheet === "score" ? t("review.action.scoreTitle") : sheet === "reassign" ? t("orders.action.reassign") : sheet === "priority" ? t("orders.action.changePriority") : sheet ? t(`orders.action.${sheet}`) : "";
  const sheetText: Record<NonNullable<Sheet>, string> = {
    close: t("master.card.closeText"),
    rework: t("master.card.reworkText"),
    cancel: t("master.card.cancelText"),
    reassign: t("master.card.reassignText"),
    priority: t("master.card.priorityText"),
    score: t("review.action.scoreText"),
  };

  return (
    <>
      {actions.includes("close") && (
        <BottomActionBar>
          <Button fullWidth onClick={() => open("close")}>
            {t("orders.action.close")}
          </Button>
          {actions.includes("rework") && (
            <Button fullWidth variant="secondary" size="md" onClick={() => open("rework")}>
              {t("orders.action.rework")}
            </Button>
          )}
        </BottomActionBar>
      )}

      {!closed && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-ink">{t("master.card.actions")}</h2>
          {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}
          {status === "ai_review" && review && (
            <Button variant="secondary" size="md" onClick={() => open("score")}>
              {t("review.action.changeScore")}
            </Button>
          )}
          {canRerun && (
            <Button variant="secondary" size="md" loading={rerunning} onClick={rerun}>
              {t("review.action.rerun")}
            </Button>
          )}
          {canReassign(status) && (
            <Button variant="secondary" size="md" onClick={() => open("reassign")}>
              {t("orders.action.reassign")}
            </Button>
          )}
          <Button variant="secondary" size="md" onClick={() => open("priority")}>
            {t("orders.action.changePriority")}
          </Button>
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
        confirmLabel={sheet === "reassign" || sheet === "priority" || sheet === "score" ? t("master.card.save") : sheetTitle}
        tone={sheet === "cancel" ? "danger" : "primary"}
        confirmDisabled={
          (needsReason && reason.trim().length === 0) ||
          (sheet === "reassign" && !newAssignee) ||
          (sheet === "score" && !newScore)
        }
        loading={loading}
        onConfirm={confirm}
        onCancel={() => setSheet(null)}
      >
        {sheet === "score" && (
          <SegmentedControl
            ariaLabel={t("review.action.scoreLabel")}
            value={newScore}
            onChange={setNewScore}
            options={SCORES.map((n) => ({ value: n, label: n }))}
          />
        )}
        {needsReason && (
          <Field label={sheet === "score" ? t("review.action.reasonLabel") : t("master.card.reason")} htmlFor="order-reason" required>
            <TextArea
              id="order-reason"
              value={reason}
              placeholder={sheet === "score" ? t("review.action.reasonPlaceholder") : t("master.card.reasonPlaceholder")}
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
