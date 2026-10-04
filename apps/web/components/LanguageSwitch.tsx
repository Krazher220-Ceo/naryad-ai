"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/ui/cx";
import { LOCALES } from "@/lib/i18n";
import { setLocale } from "@/lib/locale-actions";
import { useLocale, useT } from "./LocaleProvider";

// Переключатель «Рус / Қаз». Сохраняет выбор в cookie и перерисовывает страницу.
export function LanguageSwitch() {
  const t = useT();
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t("language.label")} className="flex shrink-0 gap-1">
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
          className={cx(
            "min-h-touch-sm min-w-12 rounded-xl border-2 px-2 text-base font-semibold",
            locale === current ? "border-brand bg-brand text-white ring-2 ring-white/70" : "border-line-strong bg-surface text-ink hover:bg-canvas",
          )}
        >
          {t(`language.short.${locale}`)}
        </button>
      ))}
    </div>
  );
}
