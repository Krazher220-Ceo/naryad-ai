import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/database.types";
import { sendTelegramMessage } from "./telegram";

export type NotificationKind = Enums<"notification_kind">;

// Уведомить сотрудника: отправить в Telegram и записать в журнал notifications.
// Если Telegram не привязан, сообщение всё равно попадает в журнал с delivered = false:
// по журналу видно, что система пыталась предупредить, а расписание не повторяет попытку каждую минуту.
// Ошибки не выбрасываются: уведомление не должно ломать цикл наряда.
export async function notifyEmployee(params: {
  employeeId: string;
  kind: NotificationKind;
  text: string;
  orderId?: string;
}): Promise<{ delivered: boolean }> {
  const supabase = createAdminClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("telegram_chat_id")
    .eq("id", params.employeeId)
    .maybeSingle();

  let delivered = false;
  let error: string | null = null;
  if (employee?.telegram_chat_id) {
    const res = await sendTelegramMessage(employee.telegram_chat_id, params.text);
    delivered = res.ok;
    if (!res.ok) error = res.error;
  } else {
    error = "telegram_not_linked";
  }

  await supabase.from("notifications").insert({
    order_id: params.orderId ?? null,
    employee_id: params.employeeId,
    kind: params.kind,
    text: params.text,
    delivered,
    error,
  });

  return { delivered };
}
