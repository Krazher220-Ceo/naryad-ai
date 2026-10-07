// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getT();
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-between p-4 py-6">
      <div className="flex justify-end">
        <LanguageSwitch />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col items-center text-center">
          <span role="img" aria-label={t("brand.company")} className="km-logo mb-4 h-16 bg-brand" />
          <h1 className="text-4xl font-bold tracking-tight text-ink">
            {t("app.name")}
          </h1>
          <p className="mt-2 max-w-xs text-sm text-ink-muted">
            {t("app.description")}
          </p>
        </div>

        <LoginForm next={typeof next === "string" ? next : undefined} />
        {/* Оператору вход не нужен: заявку о поломке можно отправить без логина. */}
        <Link
          href="/operator"
          className="flex min-h-touch items-center justify-center rounded-xl border-2 border-danger bg-surface px-4 text-lg font-semibold text-danger hover:bg-danger-soft"
        >
          {t("auth.operatorLink")}
        </Link>
      </div>

      <div className="flex flex-col items-center gap-2 pt-4 text-center">
        <Link
          href="/demo"
          className="text-sm font-semibold text-ink-muted underline hover:text-ink"
        >
          {t("demo.loginLink")}
        </Link>
        <p className="text-xs text-ink-muted">
          {t("auth.demoHint")}
        </p>
      </div>
    </main>
  );
}
