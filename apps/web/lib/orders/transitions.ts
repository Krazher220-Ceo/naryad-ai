import type { MasterAction, OrderAction, OrderStatus, WorkerAction } from "./types";

// Таблица переходов наряда (раздел 6 PLAN.md).
// Главная проверка — в базе, функция transition_order (0003_order_functions.sql).
// Здесь та же таблица нужна интерфейсу: какие кнопки показать в каком статусе.
// Если меняешь таблицу, меняй и в SQL.

type Transition = { from: OrderStatus[]; to: OrderStatus; needsReason: boolean };

export const TRANSITIONS: Record<OrderAction, Transition> = {
  accept: { from: ["issued", "queued"], to: "accepted", needsReason: false },
  queue: { from: ["issued"], to: "queued", needsReason: false },
  reject: { from: ["issued", "queued"], to: "rejected", needsReason: true },
  start: { from: ["accepted", "rework"], to: "in_progress", needsReason: false },
  pause: { from: ["in_progress"], to: "paused", needsReason: true },
  resume: { from: ["paused"], to: "in_progress", needsReason: false },
  close: { from: ["ai_review"], to: "closed", needsReason: false },
  rework: { from: ["ai_review"], to: "rework", needsReason: true },
  cancel: {
    from: ["issued", "accepted", "queued", "rejected", "in_progress", "paused", "done", "ai_review", "rework"],
    to: "cancelled",
    needsReason: true,
  },
};

const WORKER_ACTIONS: WorkerAction[] = ["accept", "queue", "reject", "start", "pause", "resume"];
const MASTER_ACTIONS: MasterAction[] = ["close", "rework", "cancel"];

// Кнопки исполнителя для статуса. «Исполнено» — отдельная форма закрытия, см. canComplete.
export function workerActions(status: OrderStatus): WorkerAction[] {
  return WORKER_ACTIONS.filter((action) => TRANSITIONS[action].from.includes(status));
}

export function masterActions(status: OrderStatus): MasterAction[] {
  return MASTER_ACTIONS.filter((action) => TRANSITIONS[action].from.includes(status));
}

// Исполнитель может открыть форму закрытия только в работе.
export function canComplete(status: OrderStatus): boolean {
  return status === "in_progress";
}

// Мастер может переназначить наряд, пока работа не начата.
export function canReassign(status: OrderStatus): boolean {
  return ["issued", "queued", "accepted", "rejected"].includes(status);
}

// Готовые причины отказа и паузы. Тексты — в словаре: orders.reasons.<код>.
export const REJECT_REASONS = ["no_materials", "no_permit", "busy_emergency", "other"] as const;
export const PAUSE_REASONS = ["waiting_parts", "waiting_permit", "waiting_stop", "other"] as const;
export type ReasonCode = (typeof REJECT_REASONS)[number] | (typeof PAUSE_REASONS)[number];

// Паузы по этим причинам не засчитываются исполнителю в просрочку (раздел 6 PLAN.md).
export const EXCUSED_PAUSE_REASONS: ReasonCode[] = ["waiting_parts", "waiting_permit", "waiting_stop"];

// Статусы, в которых наряд ещё не исполнен. Просрочка считается только для них.
const OPEN_STATUSES: OrderStatus[] = ["issued", "accepted", "queued", "rejected", "in_progress", "paused", "rework"];

// Просрочка — вычисляемый признак, а не статус: срок прошёл, а наряд ещё не исполнен.
export function isOverdue(order: { status: OrderStatus; due_at: string }, now: Date = new Date()): boolean {
  return OPEN_STATUSES.includes(order.status) && new Date(order.due_at) < now;
}
