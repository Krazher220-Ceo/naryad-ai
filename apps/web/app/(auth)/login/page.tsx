import { t } from "@/lib/i18n";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-2xl font-bold">{t("app.name")}</h1>
      <h2 className="text-lg">{t("auth.title")}</h2>
      <LoginForm />
    </main>
  );
}
