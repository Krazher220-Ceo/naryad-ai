import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { UsersTable } from "./UsersTable";

// Пользователи и сброс пароля (PLAN.md, раздел 8.6). Остальное управление ролями — в M8.
export default async function LeadUsersPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("employees").select("id, login, full_name, role").order("role").order("full_name");
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:max-w-5xl lg:py-8">
      <h1 className="text-2xl font-semibold text-ink lg:text-3xl">{t("users.title")}</h1>
      <p className="text-base text-ink-muted">{t("users.hint")}</p>
      <UsersTable users={data ?? []} />
    </main>
  );
}
