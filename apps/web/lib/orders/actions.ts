"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Translate } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { reviewOrder } from "@/lib/ai/review";
import { getCurrentEmployee } from "@/lib/auth/session";
import { classifyProblem, type Classification } from "@/lib/ai/classify";
import { suggestWorkers, type Candidate } from "./suggest";
import { notifyNewOrder, notifySideRequest, notifyStatusChange } from "./notifications";
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
function toErrorText(t: Translate, error: DbError): string {
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
  // Наряд выдан по попутной заявке исполнителя: заявка отмечается «превращена в наряд».
  requestId?: string;
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
  if (error) return { ok: false, error: toErrorText(await getT(), error) };
  // Наряд по заявке: заявка отмечается «выдан наряд» и связывается с ним (оператор увидит номер).
  if (input.requestId) {
    await supabase.rpc("decide_request", { p_request_id: input.requestId, p_status: "converted", p_order_id: data });
  }
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
  if (error) return { ok: false, error: toErrorText(await getT(), error) };
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
  if (error) return { ok: false, error: toErrorText(await getT(), error) };
  // ИИ-проверка идёт после ответа: исполнитель сразу видит «Отправлено на проверку».
  // Ошибка проверки не должна ломать закрытие — наряд просто останется у мастера.
  after(() => reviewOrder(input.orderId).catch((e) => console.error("reviewOrder failed", e)));
  refresh();
  return { ok: true, data: { status: data } };
}

// Перезапустить ИИ-проверку вручную (кнопка мастера, если модель была недоступна).
export async function rerunReview(orderId: string): Promise<ActionResult<{ started: true }>> {
  const t = await getT();
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
  if (error) return { ok: false, error: toErrorText(await getT(), error) };
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
  if (error) return { ok: false, error: toErrorText(await getT(), error) };
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
  if (error) return { ok: false, error: toErrorText(await getT(), error) };
  refresh();
  return { ok: true, data: { saved: true } };
}

// Подсказка для формы выдачи: шифр, приоритет, специальность по описанию и подходящие исполнители.
// Только мастер. Если ИИ недоступен, исполнители всё равно подбираются (без учёта специальности).
export async function suggestForIssue(description: string): Promise<
  ActionResult<{ classification: Classification | null; candidates: Candidate[] }>
> {
  const t = await getT();
  const me = await getCurrentEmployee();
  if (me?.role !== "master") return { ok: false, error: t("orders.errors.forbidden") };
  const classification = await classifyProblem(description);
  const candidates = await suggestWorkers(classification?.specialty ?? null, classification?.category ?? null);
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
  if (error) return { ok: false, error: toErrorText(await getT(), error) };
  refresh();
  return { ok: true, data: { saved: true } };
}

// «Нужна помощь»: статус не меняется, в журнал пишется событие, мастеру уходит сообщение.
export async function requestHelp(input: {
  orderId: string;
  comment?: string;
  clientActionId: string;
}): Promise<ActionResult<{ sent: true }>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_help", {
    p_order_id: input.orderId,
    p_comment: input.comment,
    p_client_action_id: input.clientActionId,
  });
  if (error) return { ok: false, error: toErrorText(await getT(), error) };
  after(() => notifyStatusChange({ orderId: input.orderId, action: "help", reason: input.comment }));
  refresh();
  return { ok: true, data: { sent: true } };
}

// Попутная находка: исполнитель заметил другую неисправность и отправляет заявку мастеру.
// Права проверяет база: заявку можно создать только от своего имени (правило insert_requests).
export async function createSideRequest(input: {
  orderId: string;
  equipmentId: string;
  description: string;
}): Promise<ActionResult<{ sent: true }>> {
  const t = await getT();
  const me = await getCurrentEmployee();
  if (!me) return { ok: false, error: t("orders.errors.forbidden") };
  if (!input.description.trim()) return { ok: false, error: t("sideRequest.descriptionRequired") };
  const supabase = await createClient();
  const { error } = await supabase.from("requests").insert({
    created_by: me.id,
    equipment_id: input.equipmentId,
    parent_order_id: input.orderId,
    description: input.description.trim(),
  });
  if (error) return { ok: false, error: toErrorText(t, error) };
  after(() => notifySideRequest(input.orderId, input.description.trim()));
  refresh();
  return { ok: true, data: { sent: true } };
}

// Мастер отклоняет заявку, обязательно с причиной. Превращение в наряд отмечается в createOrder.
export async function dismissRequest(requestId: string, reason: string): Promise<ActionResult<{ done: true }>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_request", { p_request_id: requestId, p_status: "dismissed", p_reason: reason.trim() });
  if (error) return { ok: false, error: toErrorText(await getT(), error) };
  refresh();
  return { ok: true, data: { done: true } };
}
