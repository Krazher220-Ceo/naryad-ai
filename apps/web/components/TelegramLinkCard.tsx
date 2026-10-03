import { Card, IconInfo } from "@/components/ui";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export async function TelegramLinkCard() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_telegram_link");

  if (error || !data || data.length === 0) {
    return null;
  }

  const { link_code, linked } = data[0];
  if (linked || !link_code) {
    return null;
  }

  const botUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "naryad_ai_bot").replace(/^@/, "");
  const linkUrl = `https://t.me/${botUsername}?start=${link_code}`;

  return (
    <aside aria-label={t("telegram.cardTitle")} className="mx-auto w-full max-w-xl px-4 pt-4 lg:max-w-6xl">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <IconInfo className="size-6 shrink-0 text-info" />
          <p className="text-base font-semibold text-ink">
            {t("telegram.cardText")}
          </p>
        </div>
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-touch w-full select-none items-center justify-center gap-2 rounded-xl bg-brand px-5 text-lg font-semibold text-white transition-colors hover:bg-brand-hover active:bg-black sm:w-auto shrink-0"
        >
          <span>{t("telegram.connectButton")}</span>
        </a>
      </Card>
    </aside>
  );
}
