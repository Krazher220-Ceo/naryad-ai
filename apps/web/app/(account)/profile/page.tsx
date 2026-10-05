import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, IconChevronRight } from "@/components/ui";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getCurrentEmployee } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/roles";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { BIG_TEXT_COOKIE } from "@/lib/display";
import { getT } from "@/lib/i18n-server";
import type { Enums } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { BigTextSwitch, DeviceData, NotificationPrefsForm, TelegramSection } from "./ProfileSections";

// Какие события вообще приходят сотруднику этой роли (lib/orders/notifications.ts, расписание сроков).
const KINDS_BY_ROLE: Record<Role, Enums<"notification_kind">[]> = {
  worker: ["new_order", "remind", "overdue", "review_ready", "status_change"],
  master: ["new_request", "overdue", "not_accepted", "review_ready", "status_change"],
  lead: ["lead_overdue", "overdue"],
  operator: [],
};

// Профиль одинаковый для всех ролей (PLAN.md, раздел 8.4).
export default async function ProfilePage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  const t = await getT();
  const supabase = await createClient();

  const [{ data: link }, { data: prefs }, { data: me }] = await Promise.all([
    supabase.rpc("my_telegram_link"),
    supabase.from("notification_prefs").select("telegram_off_kinds, quiet_from, quiet_to").eq("employee_id", employee.id).maybeSingle(),
    supabase.from("employees").select("login").eq("id", employee.id).maybeSingle(),
  ]);
  const telegram = link?.[0];
  const botUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "naryad_ai_bot").replace(/^@/, "");
  const connectUrl = telegram?.link_code ? `https://t.me/${botUsername}?start=${telegram.link_code}` : null;
  const bigText = (await cookies()).get(BIG_TEXT_COOKIE)?.value === "1";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:max-w-3xl lg:py-8">
      <Card className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand font-display text-2xl text-white">
          {employee.fullName.split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-2xl font-semibold text-ink">{employee.fullName}</h1>
          <span className="text-base text-ink-muted">
            {t(`roles.${employee.role}`)}
            {me?.login ? ` · ${t("profile.login").replace("{login}", me.login)}` : ""}
          </span>
        </div>
      </Card>

      <Link
        href="/profile/password"
        className="flex min-h-touch items-center justify-between rounded-2xl border border-line bg-surface px-4 text-lg font-semibold text-ink hover:bg-canvas"
      >
        {t("password.open")}
        <IconChevronRight className="size-5 text-ink-muted" />
      </Link>

      <TelegramSection linked={Boolean(telegram?.linked)} connectUrl={connectUrl} />

      <NotificationPrefsForm
        kinds={KINDS_BY_ROLE[employee.role]}
        initialOff={prefs?.telegram_off_kinds ?? []}
        initialFrom={prefs?.quiet_from?.slice(0, 5) ?? null}
        initialTo={prefs?.quiet_to?.slice(0, 5) ?? null}
      />

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-ink">{t("profile.display.title")}</h2>
        <div className="flex flex-col gap-2">
          <span className="text-base font-semibold text-ink">{t("profile.display.language")}</span>
          <LanguageSwitch full />
        </div>
        <BigTextSwitch on={bigText} />
      </Card>

      <DeviceData />

      <SignOutButton className="min-h-touch w-full rounded-xl border-2 border-danger bg-surface px-5 text-lg font-semibold text-danger hover:bg-danger-soft">
        {t("profile.signOut")}
      </SignOutButton>
    </main>
  );
}
