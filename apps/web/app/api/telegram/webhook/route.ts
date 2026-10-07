// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { tRu as t } from "@/lib/i18n";
import { sendTelegramMessage } from "@/lib/notify/telegram";
import { createAdminClient } from "@/lib/supabase/admin";

type TelegramChat = {
  id: number;
};

type TelegramFrom = {
  first_name: string;
};

type TelegramMessage = {
  message_id?: number;
  chat: TelegramChat;
  from?: TelegramFrom;
  text?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

export async function POST(request: Request) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!secret || secretHeader !== secret) {
    return new Response(null, { status: 401 });
  }

  try {
    const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
    const message = update?.message;
    const chatId = message?.chat?.id;

    if (typeof chatId === "number") {
      const text = message?.text?.trim() ?? "";
      const match = text.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/);

      if (match && match[1]?.trim()) {
        const linkCode = match[1].trim();
        const adminClient = createAdminClient();
        const { data: employee } = await adminClient
          .from("employees")
          .select("id, full_name")
          .eq("telegram_link_code", linkCode)
          .maybeSingle();

        if (employee) {
          await adminClient
            .from("employees")
            .update({ telegram_chat_id: chatId })
            .eq("id", employee.id);

          const replyText = t("telegram.linkSuccess").replace("{name}", employee.full_name);
          await sendTelegramMessage(chatId, replyText);
        } else {
          await sendTelegramMessage(chatId, t("telegram.codeNotFound"));
        }
      } else {
        await sendTelegramMessage(chatId, t("telegram.help"));
      }
    }
  } catch (error) {
    console.error("Telegram webhook error:", error);
  }

  return Response.json({ ok: true });
}
