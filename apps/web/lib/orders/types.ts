// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import type { Enums, Tables } from "@/lib/supabase/database.types";

// Типы наряда. Значения совпадают с перечислениями в базе (supabase/migrations/0001_init.sql).
export type OrderStatus = Enums<"order_status">;
export type OrderPriority = Enums<"order_priority">;
export type OrderType = Enums<"order_type">;
export type PhotoKind = Enums<"photo_kind">;

export type WorkOrder = Tables<"work_orders">;
export type OrderEvent = Tables<"work_order_events">;

// Цвет исполнителя на панели мастера (представление worker_board).
export type WorkerBoardStatus = "free" | "busy" | "queue" | "off";

// Действия, которые меняют статус через transition_order.
export type WorkerAction = "accept" | "queue" | "reject" | "start" | "pause" | "resume";
export type MasterAction = "close" | "rework" | "cancel";
export type OrderAction = WorkerAction | MasterAction;

// Результат серверного действия: либо данные, либо текст ошибки для показа человеку.
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
