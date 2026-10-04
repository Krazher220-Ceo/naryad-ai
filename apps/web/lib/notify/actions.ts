"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import type { Enums } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/orders/types";
import { BIG_TEXT_COOKIE } from "@/lib/display";

// Действия центра уведомлений и профиля. Всё идёт через функции базы
// (0012_notification_center.sql): сотрудник меняет только свои уведомления и настройки.

export async function markAllRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", {});
  refresh();
}

// Нажатие на уведомление: отметить прочитанным и открыть наряд, если он есть.
export async function openNotification(id: string, href: string | null): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_ids: [id] });
  if (href && href.startsWith("/") && !href.startsWith("//")) redirect(href);
  refresh();
}

export type NotificationPrefsInput = {
  telegramOffKinds: Enums<"notification_kind">[];
  quietFrom: string | null; // "22:00"
  quietTo: string | null;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveNotificationPrefs(input: NotificationPrefsInput): Promise<ActionResult<null>> {
  const t = await getT();
  const quietFrom = input.quietFrom && TIME.test(input.quietFrom) ? input.quietFrom : null;
  const quietTo = input.quietTo && TIME.test(input.quietTo) ? input.quietTo : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_notification_prefs", {
    p_telegram_off_kinds: input.telegramOffKinds,
    // Тихие часы задаются парой: если одно время пустое, тихих часов нет.
    p_quiet_from: quietFrom && quietTo ? quietFrom : null,
    p_quiet_to: quietFrom && quietTo ? quietTo : null,
  });
  if (error) return { ok: false, error: t("orders.errors.unknown") };
  return { ok: true, data: null };
}

export async function unlinkTelegram(): Promise<ActionResult<null>> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlink_telegram", {});
  if (error) return { ok: false, error: t("orders.errors.unknown") };
  refresh();
  return { ok: true, data: null };
}

// Крупный текст запоминается в cookie, чтобы сервер сразу рисовал страницу нужного размера.
export async function setBigText(on: boolean): Promise<void> {
  const store = await cookies();
  if (on) store.set(BIG_TEXT_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  else store.delete(BIG_TEXT_COOKIE);
  refresh();
}
