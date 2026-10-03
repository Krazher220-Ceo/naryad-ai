import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { requireRole } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function MasterSettingsPage() {
  const employee = await requireRole("master");
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("remind_before_min, accept_timeout_min, accept_timeout_urgent_min, overdue_repeat_min, lead_escalate_after_min, ai_provider")
    .eq("id", 1)
    .single();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <AppHeader fullName={employee.fullName} roleLabel={t("roles.master")} />

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
