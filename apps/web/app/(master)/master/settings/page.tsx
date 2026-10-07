// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function MasterSettingsPage() {
  const t = await getT();
  await requireRole("master");
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("remind_before_min, accept_timeout_min, accept_timeout_urgent_min, overdue_repeat_min, lead_escalate_after_min, ai_provider")
    .eq("id", 1)
    .single();

  return (
    <div className="flex flex-1 flex-col bg-canvas">

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6 lg:max-w-2xl">
        <div className="flex flex-col gap-2">
          <Link href="/master" className="text-base font-semibold text-ink underline">
            {t("settings.back")}
          </Link>
          <h1 className="text-2xl font-bold text-ink">{t("settings.title")}</h1>
          <p className="text-base text-ink-muted">{t("settings.description")}</p>
        </div>

        <SettingsForm initialSettings={settings} />
      </main>
    </div>
  );
}
