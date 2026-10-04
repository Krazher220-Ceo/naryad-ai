import { getT } from "@/lib/i18n-server";
import { PasswordForm } from "./PasswordForm";

// Смена пароля (набросок «Смена пароля»): текущий, новый, повтор, проверка правил вживую.
export default async function PasswordPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:py-8">
      <h1 className="text-2xl font-semibold text-ink lg:text-3xl">{t("password.title")}</h1>
      <PasswordForm />
    </main>
  );
}
