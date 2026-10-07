// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  urgent?: boolean;
};

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

// Ключи не заданы — push тихо отключён, остальные каналы работают как раньше.
export function isPushConfigured(): boolean {
  return Boolean(publicKey && privateKey && subject);
}

// Отправить push на все устройства сотрудника. Ошибки не выбрасываются.
// Подписки, которые браузер удалил (404/410), стираются из базы.
export async function sendPush(employeeId: string, payload: PushPayload): Promise<{ sent: number }> {
  if (!isPushConfigured()) return { sent: 0 };
  try {
    webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    const supabase = createAdminClient();
    const { data: subs } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("employee_id", employeeId);
    if (!subs?.length) return { sent: 0 };

    const body = JSON.stringify(payload);
    const gone: string[] = [];
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60, urgency: payload.urgent ? "high" : "normal" });
          sent += 1;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(s.id);
        }
      }),
    );
    if (gone.length) await supabase.from("push_subscriptions").delete().in("id", gone);
    return { sent };
  } catch {
    return { sent: 0 };
  }
}
