import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEmployee } from "@/lib/notify";
import { newOrderText } from "@/lib/notify/messages";

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
