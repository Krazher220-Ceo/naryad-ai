import { t } from "@/lib/i18n";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-between p-4 py-6">
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            {t("app.name")}
          </h1>
          <p className="mt-2 max-w-xs text-sm text-slate-600">
            {t("app.description")}
          </p>
        </div>

        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>

      <p className="pt-4 text-center text-xs text-slate-500">
        {t("auth.demoHint")}
      </p>
    </main>
  );
}
