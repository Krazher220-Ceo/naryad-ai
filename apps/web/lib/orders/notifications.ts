// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEmployee } from "@/lib/notify";
import { newOrderText, statusChangeText, type StatusNotifyAction } from "@/lib/notify/messages";
import { tRu as t } from "@/lib/i18n";

// Уведомление о новом (или переназначенном) наряде.
// Исполнителю — лично; если наряд на бригаду — всем исполнителям бригады.
export async function notifyNewOrder(orderId: string): Promise<void> {
  const db = createAdminClient();
  const { data: o } = await db
    .from("work_orders")
    .select(
      `number, priority, status, description, due_at, assignee_id, brigade,
       equipment:equipment_id ( name ), section:section_id ( name ),
       assignee:employees!work_orders_assignee_id_fkey ( full_name )`,
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return;

  let recipients: string[] = [];
  if (o.assignee_id) recipients = [o.assignee_id];
  else if (o.brigade) {
    const { data } = await db.from("employees").select("id").eq("role", "worker").eq("brigade", o.brigade);
    recipients = (data ?? []).map((e) => e.id);
  }

  const text = newOrderText({
    number: o.number,
    priority: o.priority,
    status: o.status,
    description: o.description,
    equipment: o.equipment?.name ?? "—",
    section: o.section?.name ?? "—",
    dueAt: o.due_at,
    workerName: o.assignee?.full_name ?? null,
  });
  await Promise.all(recipients.map((employeeId) => notifyEmployee({ employeeId, kind: "new_order", text, orderId })));
}

// Уведомление о смене статуса. Кому — зависит от действия:
// доработка, отмена, закрытие — исполнителю; отказ и пауза — мастеру.
const TO_WORKER: StatusNotifyAction[] = ["rework", "cancel", "close"];
const TO_MASTER: StatusNotifyAction[] = ["reject", "pause", "help"];

export async function notifyStatusChange(params: {
  orderId: string;
  action: string;
  reason?: string;
  reasonCode?: string;
}): Promise<void> {
  const action = params.action as StatusNotifyAction;
  if (!TO_WORKER.includes(action) && !TO_MASTER.includes(action)) return;

  const db = createAdminClient();
  const { data: o } = await db
    .from("work_orders")
    .select(
      `number, assignee_id, master_id,
       equipment:equipment_id ( name ), section:section_id ( name ),
       assignee:employees!work_orders_assignee_id_fkey ( full_name )`,
    )
    .eq("id", params.orderId)
    .maybeSingle();
  if (!o) return;

  // Причина: свой текст или подпись готовой причины из словаря.
  const reason =
    params.reason?.trim() ||
    (params.reasonCode ? t(`orders.reasons.${params.reasonCode}` as Parameters<typeof t>[0]) : null);
  const text = statusChangeText(
    action,
    { number: o.number, equipment: o.equipment?.name ?? "—", section: o.section?.name ?? "—", workerName: o.assignee?.full_name ?? null },
    reason,
  );
  const employeeId = TO_WORKER.includes(action) ? o.assignee_id : o.master_id;
  if (employeeId) await notifyEmployee({ employeeId, kind: "status_change", text, orderId: params.orderId });
}

// Попутная находка исполнителя — мастеру наряда.
export async function notifySideRequest(orderId: string, description: string): Promise<void> {
  const db = createAdminClient();
  const { data: o } = await db
    .from("work_orders")
    .select(
      `number, master_id,
       equipment:equipment_id ( name ), section:section_id ( name ),
       assignee:employees!work_orders_assignee_id_fkey ( full_name )`,
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return;
  const text = statusChangeText(
    "side_request",
    { number: o.number, equipment: o.equipment?.name ?? "—", section: o.section?.name ?? "—", workerName: o.assignee?.full_name ?? null },
    description,
  );
  await notifyEmployee({ employeeId: o.master_id, kind: "status_change", text, orderId });
}
