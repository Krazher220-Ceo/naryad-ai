"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, translator, type Locale, type Translate } from "@/lib/i18n";

// Язык для клиентских компонентов. Значение приходит из корневого layout (cookie на сервере),
// поэтому сервер и браузер рисуют одинаковый текст.
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

// В клиентских компонентах: const t = useT();
export function useT(): Translate {
  return translator(useLocale());
}

// Язык распознавания речи для голосового ввода.
export function useSpeechLang(): string {
  return useLocale() === "kk" ? "kk-KZ" : "ru-RU";
}
