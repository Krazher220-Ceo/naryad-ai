// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
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
  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("telegram_off_kinds, quiet_from, quiet_to")
    .eq("employee_id", params.employeeId)
    .maybeSingle();

  let delivered = false;
  let error: string | null = null;
  // В центре уведомлений запись появляется всегда. Telegram молчит, если сотрудник
  // отключил это событие или сейчас его тихие часы.
  const muted = prefs ? prefs.telegram_off_kinds.includes(params.kind) || isQuietNow(prefs.quiet_from, prefs.quiet_to) : false;
  if (muted) {
    error = "muted_by_prefs";
  } else if (employee?.telegram_chat_id) {
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

// Тихие часы задаются временем завода (Костанай, UTC+5). Интервал может переходить через полночь: 22:00–06:00.
function isQuietNow(from: string | null, to: string | null, now = new Date()): boolean {
  if (!from || !to) return false;
  const local = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const start = toMinutes(from);
  const end = toMinutes(to);
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}
