import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isOverdue } from "./transitions";
import type { OrderPriority, WorkerBoardStatus } from "./types";
import type { ReviewChecks } from "@/lib/ai/types";

// Чтение данных для экранов. Запросы идут от имени вошедшего пользователя,
// поэтому каждый видит только то, что разрешают правила доступа базы.

// Порядок на доске: аварийные наверху, потом по сроку.
const PRIORITY_RANK: Record<OrderPriority, number> = { emergency: 0, high: 1, normal: 2, planned: 3 };

const ORDER_LIST_FIELDS = `
  id, number, type, description, priority, status, due_at, created_at, updated_at,
  assignee_id, brigade,
  equipment:equipment_id ( id, name, inventory_no, type ),
  section:section_id ( id, name ),
  assignee:employees!work_orders_assignee_id_fkey ( id, full_name )
`;

function sortOrders<T extends { priority: OrderPriority; due_at: string }>(orders: T[]): T[] {
  return [...orders].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.due_at.localeCompare(b.due_at),
  );
}

// Начало текущих суток: счётчики смены считаем за сегодня.
function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Панель мастера: исполнители со статусами, открытые наряды, счётчики смены.
export async function getMasterBoard() {
  const supabase = await createClient();

  const [workersRes, ordersRes, todayRes, requestsRes] = await Promise.all([
    supabase.from("worker_board").select("*").order("full_name"),
    supabase.from("work_orders").select(ORDER_LIST_FIELDS).not("status", "in", "(closed,cancelled)"),
    supabase.from("work_orders").select("status, done_at").gte("created_at", startOfToday()),
    // Заявки, которые ждут решения мастера: операторов по QR и попутные находки исполнителей.
    supabase
      .from("requests")
      .select(
        `id, number, description, created_at, equipment_id, machine_state, reporter_name, photo_path,
         equipment:equipment_id ( name ), section:section_id ( name ),
         author:created_by ( full_name, role ), parent:parent_order_id ( number )`,
      )
      .eq("status", "new")
      .order("created_at", { ascending: false }),
  ]);
  if (workersRes.error) throw workersRes.error;
  if (ordersRes.error) throw ordersRes.error;
  if (todayRes.error) throw todayRes.error;

  const orders = sortOrders(ordersRes.data).map((o) => ({ ...o, overdue: isOverdue(o) }));
  const workers = workersRes.data.map((w) => ({ ...w, board_status: w.board_status as WorkerBoardStatus }));

  const counters = {
    issued: todayRes.data.length,
    done: todayRes.data.filter((o) => o.done_at !== null).length,
    overdue: orders.filter((o) => o.overdue).length,
    // Оборудование в простое: есть открытый внеплановый наряд.
    equipmentDown: new Set(orders.filter((o) => o.type === "unplanned").map((o) => o.equipment?.id)).size,
  };

  return { workers, orders, counters, requests: requestsRes.data ?? [] };
}

export type MasterBoard = Awaited<ReturnType<typeof getMasterBoard>>;

// «Мои наряды» исполнителя: открытые сверху, затем закрытые за последние 7 дней.
export async function getWorkerOrders() {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [openRes, closedRes] = await Promise.all([
    supabase.from("work_orders").select(ORDER_LIST_FIELDS).not("status", "in", "(closed,cancelled)"),
    supabase
      .from("work_orders")
      .select(ORDER_LIST_FIELDS)
      .in("status", ["closed", "cancelled"])
      .gte("updated_at", weekAgo)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  if (openRes.error) throw openRes.error;
  if (closedRes.error) throw closedRes.error;

  return {
    open: sortOrders(openRes.data).map((o) => ({ ...o, overdue: isOverdue(o) })),
    recent: closedRes.data,
  };
}

export type WorkerOrders = Awaited<ReturnType<typeof getWorkerOrders>>;

// Полная карточка наряда: поля, журнал, фото (временные ссылки), материалы.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrderDetails(orderId: string) {
  // Неверный адрес в строке браузера: «не найден», а не ошибка базы.
  if (!UUID_RE.test(orderId)) return null;
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("work_orders")
    .select(
      `*,
      equipment:equipment_id ( id, name, inventory_no, type ),
      section:section_id ( id, name ),
      assignee:employees!work_orders_assignee_id_fkey ( id, full_name, specialty ),
      master:employees!work_orders_master_id_fkey ( id, full_name ),
      fault:fault_code ( code, name, norm_hours )`,
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;

  const [eventsRes, photosRes, materialsRes, reviewRes, toBringRes, historyRes] = await Promise.all([
    supabase
      .from("work_order_events")
      .select("id, action, from_status, to_status, comment, reason, reason_code, created_at, actor:actor_id ( full_name )")
      .eq("order_id", orderId)
      .order("created_at"),
    supabase.from("photos").select("id, kind, path, created_at").eq("order_id", orderId).order("created_at"),
    supabase
      .from("material_usages")
      .select("id, qty, material:material_id ( id, name, unit, typical_qty )")
      .eq("order_id", orderId),
    // Последняя проверка ИИ: после доработки наряд проверяется заново.
    supabase
      .from("ai_reviews")
      .select("id, verdict, score, confidence, checks, explanation, source, master_score, master_reason, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // «Что взять с собой»: типовые материалы по шифру наряда.
    order.fault_code
      ? supabase.from("materials").select("id, name, unit, typical_qty").contains("fault_codes", [order.fault_code]).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string; unit: string; typical_qty: number }[], error: null }),
    // «Как чинили в прошлый раз»: последние закрытые наряды по этому оборудованию (без имён).
    supabase.rpc("equipment_repair_history", { p_equipment_id: order.equipment_id, p_exclude_order_id: order.id }),
  ]);
  if (eventsRes.error) throw eventsRes.error;
  if (photosRes.error) throw photosRes.error;
  if (materialsRes.error) throw materialsRes.error;

  // Хранилище закрытое: для показа делаем ссылки, которые живут 1 час.
  const photos = await Promise.all(
    photosRes.data.map(async (p) => {
      const { data } = await supabase.storage.from("photos").createSignedUrl(p.path, 60 * 60);
      return { ...p, url: data?.signedUrl ?? null };
    }),
  );

  return {
    order: { ...order, overdue: isOverdue(order) },
    events: eventsRes.data,
    photos,
    materials: materialsRes.data,
    review: reviewRes.data ? { ...reviewRes.data, checks: reviewRes.data.checks as unknown as ReviewChecks } : null,
    // Подсказки не обязательны: если запрос не удался, карточка открывается без них.
    toBring: toBringRes.data ?? [],
    repairHistory: historyRes.data ?? [],
  };
}

export type OrderDetails = NonNullable<Awaited<ReturnType<typeof getOrderDetails>>>;

// Справочники для формы выдачи наряда.
export async function getIssueFormData() {
  const supabase = await createClient();
  const [sections, equipment, workers, faultCodes, openOrders, templates] = await Promise.all([
    supabase.from("sections").select("id, name").order("name"),
    supabase.from("equipment").select("id, name, inventory_no, section_id, type").order("name"),
    supabase.from("worker_board").select("*").order("full_name"),
    supabase.from("fault_codes").select("code, category, name, norm_hours").order("code"),
    // Открытые наряды: предупреждение о дубле, если по оборудованию уже есть незакрытый наряд.
    supabase
      .from("work_orders")
      .select("id, number, equipment_id, status, description")
      .not("status", "in", "(closed,cancelled)")
      .order("created_at", { ascending: false }),
    // Шаблоны плановых работ.
    supabase.from("order_templates").select("id, name, type, fault_code, description").order("name"),
  ]);
  for (const res of [sections, equipment, workers, faultCodes, openOrders, templates]) if (res.error) throw res.error;

  return {
    sections: sections.data ?? [],
    equipment: equipment.data ?? [],
    workers: (workers.data ?? []).map((w) => ({ ...w, board_status: w.board_status as WorkerBoardStatus })),
    faultCodes: faultCodes.data ?? [],
    openOrders: openOrders.data ?? [],
    templates: templates.data ?? [],
  };
}

export type IssueFormData = Awaited<ReturnType<typeof getIssueFormData>>;

// Справочники для формы закрытия: шифры и материалы.
export async function getCloseFormData() {
  const supabase = await createClient();
  const [faultCodes, materials] = await Promise.all([
    supabase.from("fault_codes").select("code, category, name, norm_hours").order("code"),
    supabase.from("materials").select("id, name, unit, typical_qty, fault_codes").order("name"),
  ]);
  if (faultCodes.error) throw faultCodes.error;
  if (materials.error) throw materials.error;
  return { faultCodes: faultCodes.data, materials: materials.data };
}

export type CloseFormData = Awaited<ReturnType<typeof getCloseFormData>>;

// Попутная заявка для формы выдачи. Только новые: обработанную заявку повторно не выдаём.
export async function getRequest(requestId: string) {
  if (!UUID_RE.test(requestId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("id, number, description, equipment_id")
    .eq("id", requestId)
    .eq("status", "new")
    .maybeSingle();
  return data;
}

// Сводка руководителя «на сейчас» (PLAN.md, раздел 8.6): открытые наряды, просрочка, аварийные.
// Просрочка считается кодом (isOverdue), а не хранится статусом.
export async function getLeadSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_orders")
    .select(
      `id, number, description, priority, status, due_at,
       equipment:equipment_id ( name ),
       master:employees!work_orders_master_id_fkey ( full_name ),
       assignee:employees!work_orders_assignee_id_fkey ( full_name )`,
    )
    .not("status", "in", "(closed,cancelled)");
  if (error) throw error;
  const orders = sortOrders(data).map((o) => ({ ...o, overdue: isOverdue(o) }));
  const open = orders.filter((o) => !["done", "ai_review"].includes(o.status));
  const overdue = open.filter((o) => o.overdue);
  return {
    overdue: overdue.length,
    emergency: open.filter((o) => o.priority === "emergency").length,
    inWork: open.filter((o) => ["in_progress", "paused", "accepted"].includes(o.status)).length,
    // Эскалации: просроченные наряды, самые давние первыми.
    escalations: [...overdue]
      .sort((a, b) => a.due_at.localeCompare(b.due_at))
      .slice(0, 3)
      .map((o) => ({ ...o, lateMin: Math.max(1, Math.round((Date.now() - new Date(o.due_at).getTime()) / 60000)) })),
  };
}
