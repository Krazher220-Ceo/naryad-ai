// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use server";

import { getCurrentEmployee } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { tRu } from "@/lib/i18n";
import type { ActionResult } from "@/lib/orders/types";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "./push";

// Подписка устройства на push. Пишем от имени сотрудника: правила доступа
// (0017_push_subscriptions.sql) не дадут записать чужую строку.
export async function savePushSubscription(input: { endpoint: string; p256dh: string; auth: string; userAgent?: string }): Promise<ActionResult<null>> {
  const t = await getT();
  const employee = await getCurrentEmployee();
  if (!employee) return { ok: false, error: t("orders.errors.unknown") };
  if (!input.endpoint.startsWith("https://") || !input.p256dh || !input.auth) return { ok: false, error: t("profile.push.failed") };

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      employee_id: employee.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: t("profile.push.failed") };
  return { ok: true, data: null };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult<null>> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { ok: false, error: t("orders.errors.unknown") };
  return { ok: true, data: null };
}

// Проверочное уведомление самому себе.
export async function sendTestPush(): Promise<ActionResult<null>> {
  const t = await getT();
  const employee = await getCurrentEmployee();
  if (!employee) return { ok: false, error: t("orders.errors.unknown") };
  const { sent } = await sendPush(employee.id, {
    title: tRu("push.testTitle"),
    body: tRu("push.testBody"),
    url: "/notifications",
    tag: "test",
  });
  if (sent === 0) return { ok: false, error: t("profile.push.notConfigured") };
  return { ok: true, data: null };
}
