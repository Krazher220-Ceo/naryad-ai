// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/ui/cx";
import { LOCALES } from "@/lib/i18n";
import { setLocale } from "@/lib/locale-actions";
import { useLocale, useT } from "./LocaleProvider";

// Переключатель «Рус / Қаз». Сохраняет выбор в cookie и перерисовывает страницу.
// full — две большие кнопки «Русский / Қазақша» на тёмном меню ПК и в профиле.
export function LanguageSwitch({ full = false, dark = false }: { full?: boolean; dark?: boolean }) {
  const t = useT();
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={full ? cx("grid grid-cols-2 gap-1 rounded-xl p-1", dark ? "bg-white/10" : "bg-canvas") : "flex shrink-0 gap-1"}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          disabled={pending}
          aria-pressed={locale === current}
          onClick={() =>
            startTransition(async () => {
              await setLocale(locale);
              router.refresh();
            })
          }
          className={
            full
              ? cx(
                  "min-h-touch-sm rounded-lg px-2 text-base font-bold",
                  locale === current ? "bg-accent text-ink" : dark ? "text-white hover:bg-white/10" : "text-ink hover:bg-surface",
                )
              : cx(
                  "min-h-touch-sm min-w-12 rounded-xl border-2 px-2 text-base font-semibold",
                  locale === current ? "border-brand bg-brand text-white ring-2 ring-white/70" : "border-line-strong bg-surface text-ink hover:bg-canvas",
                )
          }
        >
          {full ? t(`language.full.${locale}`) : t(`language.short.${locale}`)}
        </button>
      ))}
    </div>
  );
}
