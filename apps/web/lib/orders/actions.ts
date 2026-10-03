"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import { reviewOrder } from "@/lib/ai/review";
import { getCurrentEmployee } from "@/lib/auth/session";
import { classifyProblem, type Classification } from "@/lib/ai/classify";
import { suggestWorkers, type Candidate } from "./suggest";
import { notifyNewOrder, notifyStatusChange } from "./notifications";
import type { ActionResult, OrderAction, OrderPriority, OrderStatus, OrderType } from "./types";

// Серверные действия с нарядом. Единственный путь изменить наряд из интерфейса.
// Каждое действие вызывает функцию базы (0003_order_functions.sql) от имени вошедшего
// пользователя: права, допустимость перехода и запись в журнал проверяет база.
//
// clientActionId — случайный uuid, который создаёт телефон на каждое нажатие.
// Если запрос повторится (плохая связь, офлайн-очередь), база не выполнит действие дважды.

type DbError = { code?: string; message: string };

// Ошибку базы превращаем в понятный текст.
// 22023 — наша проверка данных: её текст уже написан для человека в SQL.
function toErrorText(error: DbError): string {
  if (error.code === "42501") return t("orders.errors.forbidden");
  if (error.code === "P0002") return t("orders.errors.notFound");
  if (error.code === "22023") return error.message;
  return t("orders.errors.unknown");
}

export type CreateOrderInput = {
  type: OrderType;
  description: string;
  sectionId: string;
  equipmentId: string;
  priority: OrderPriority;
  dueAt: string; // ISO-время
  assigneeId?: string;
  brigade?: string;
  comment?: string;
  faultCode?: string;
  clientActionId: string;
};

export async function createOrder(input: CreateOrderInput): Promise<ActionResult<{ orderId: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_type: input.type,
    p_description: input.description,
    p_section_id: input.sectionId,
    p_equipment_id: input.equipmentId,
    p_priority: input.priority,
    p_due_at: input.dueAt,
    p_assignee_id: input.assigneeId,
    p_brigade: input.brigade,
    p_comment: input.comment,
    p_fault_code: input.faultCode,
    p_client_action_id: input.clientActionId,
  });
  if (error) return { ok: false, error: toErrorText(error) };
  // Сообщение исполнителю отправляем после ответа: мастер не ждёт Telegram.
  after(() => notifyNewOrder(data));
  refresh();
  return { ok: true, data: { orderId: data } };
}

export type TransitionInput = {
  orderId: string;
  action: OrderAction;
  reason?: string;
  reasonCode?: string;
  comment?: string;
  clientActionId: string;
};

export async function transitionOrder(input: TransitionInput): Promise<ActionResult<{ status: OrderStatus }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transition_order", {
    p_order_id: input.orderId,
    p_action: input.action,
    p_reason: input.reason,
    p_reason_code: input.reasonCode,
    p_comment: input.comment,
    p_client_action_id: input.clientActionId,
  });
  if (error) return { ok: false, error: toErrorText(error) };
  after(() =>
    notifyStatusChange({ orderId: input.orderId, action: input.action, reason: input.reason, reasonCode: input.reasonCode }),
  );
  refresh();
  return { ok: true, data: { status: data } };
}

export type CompleteOrderInput = {
  orderId: string;
  workDone: string;
  faultCode: string;
  materials: { materialId: string; qty: number }[];
  comment?: string;
  clientActionId: string;
};

// «Исполнено»: фото «после» должны быть загружены до вызова (lib/orders/photos.ts).
export async function completeOrder(input: CompleteOrderInput): Promise<ActionResult<{ status: OrderStatus }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_order", {
    p_order_id: input.orderId,
    p_work_done: input.workDone,
    p_fault_code: input.faultCode,
    p_materials: input.materials.map((m) => ({ material_id: m.materialId, qty: m.qty })),
    p_comment: input.comment,
    p_client_action_id: input.clientActionId,
  });
  if (error) return { ok: false, error: toErrorText(error) };
  // ИИ-проверка идёт после ответа: исполнитель сразу видит «Отправлено на проверку».
  // Ошибка проверки не должна ломать закрытие — наряд просто останется у мастера.
  after(() => reviewOrder(input.orderId).catch((e) => console.error("reviewOrder failed", e)));
  refresh();
  return { ok: true, data: { status: data } };
}

// Перезапустить ИИ-проверку вручную (кнопка мастера, если модель была недоступна).
export async function rerunReview(orderId: string): Promise<ActionResult<{ started: true }>> {
  const me = await getCurrentEmployee();
  if (me?.role !== "master") return { ok: false, error: t("orders.errors.forbidden") };
  after(() => reviewOrder(orderId).catch((e) => console.error("reviewOrder failed", e)));
  return { ok: true, data: { started: true } };
}

export type ReassignInput = {
  orderId: string;
  assigneeId?: string;
  brigade?: string;
  comment?: string;
  clientActionId: string;
};

export async function reassignOrder(input: ReassignInput): Promise<ActionResult<{ status: OrderStatus }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reassign_order", {
    p_order_id: input.orderId,
    p_assignee_id: input.assigneeId,
    p_brigade: input.brigade,
    p_comment: input.comment,
    p_client_action_id: input.clientActionId,
  });
  if (error) return { ok: false, error: toErrorText(error) };
  after(() => notifyNewOrder(input.orderId));
  refresh();
  return { ok: true, data: { status: data } };
}

export async function changeOrderPriority(input: {
  orderId: string;
  priority: OrderPriority;
  clientActionId: string;
}): Promise<ActionResult<{ priority: OrderPriority }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("change_order_priority", {
    p_order_id: input.orderId,
    p_priority: input.priority,
    p_client_action_id: input.clientActionId,
  });
  if (error) return { ok: false, error: toErrorText(error) };
  refresh();
  return { ok: true, data: { priority: data } };
}

// Мастер меняет оценку ИИ. Причина обязательна, изменение попадает в историю наряда.
export async function setMasterScore(input: {
  reviewId: string;
  score: number;
  reason: string;
}): Promise<ActionResult<{ saved: true }>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_master_score", {
    p_review_id: input.reviewId,
    p_score: input.score,
    p_reason: input.reason,
  });
  if (error) return { ok: false, error: toErrorText(error) };
  refresh();
  return { ok: true, data: { saved: true } };
}

// Подсказка для формы выдачи: шифр, приоритет, специальность по описанию и подходящие исполнители.
// Только мастер. Если ИИ недоступен, исполнители всё равно подбираются (без учёта специальности).
export async function suggestForIssue(description: string): Promise<
  ActionResult<{ classification: Classification | null; candidates: Candidate[] }>
> {
  const me = await getCurrentEmployee();
  if (me?.role !== "master") return { ok: false, error: t("orders.errors.forbidden") };
  const classification = await classifyProblem(description);
  const candidates = await suggestWorkers(classification?.specialty ?? null);
  return { ok: true, data: { classification, candidates } };
}

// Пороги контроля сроков и режим ИИ (мастер или руководитель). Права проверяет база (update_settings).
export type SettingsInput = {
  remindBeforeMin: number;
  acceptTimeoutMin: number;
  acceptTimeoutUrgentMin: number;
  overdueRepeatMin: number;
  leadEscalateAfterMin: number;
  aiProvider: "cloud" | "local";
};

export async function updateSettings(input: SettingsInput): Promise<ActionResult<{ saved: true }>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_settings", {
    p_remind_before_min: input.remindBeforeMin,
    p_accept_timeout_min: input.acceptTimeoutMin,
    p_accept_timeout_urgent_min: input.acceptTimeoutUrgentMin,
    p_overdue_repeat_min: input.overdueRepeatMin,
    p_lead_escalate_after_min: input.leadEscalateAfterMin,
    p_ai_provider: input.aiProvider,
  });
  if (error) return { ok: false, error: toErrorText(error) };
  refresh();
  return { ok: true, data: { saved: true } };
}
