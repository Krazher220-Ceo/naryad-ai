// Типы берутся из ядра, чтобы значения совпадали с базой.
import type { OrderPriority, OrderStatus, OrderType, WorkerBoardStatus } from "@/lib/orders/types";

export type { OrderStatus } from "@/lib/orders/types";
export type { Role } from "@/lib/auth/roles";
export type Priority = OrderPriority;
export type WorkType = OrderType;
// Состояние исполнителя на панели мастера.
export type WorkerState = WorkerBoardStatus;

export const ORDER_STATUSES: OrderStatus[] = [
  "issued",
  "accepted",
  "queued",
  "rejected",
  "in_progress",
  "paused",
  "done",
  "ai_review",
  "rework",
  "closed",
  "cancelled",
];

export const PRIORITIES: Priority[] = ["emergency", "high", "normal", "planned"];

export const WORK_TYPES: WorkType[] = ["planned", "unplanned"];
