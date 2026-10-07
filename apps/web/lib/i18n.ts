// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import ru from "@/messages/ru.json";
import kk from "@/messages/kk.json";

// Словари надписей: русский и казахский с одинаковой структурой.
// На сервере язык берётся из cookie (getT в lib/i18n-server.ts), в браузере — из useT() (components/LocaleProvider).

type Dict = typeof ru;

export const LOCALES = ["ru", "kk"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "lang";

// Тип Record<Locale, Dict> проверяет при сборке, что в kk.json есть все ключи из ru.json.
const DICTS: Record<Locale, Dict> = { ru, kk };

// Ключи вида "auth.title": собираются из структуры словаря.
type Path<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : Path<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Path<Dict>;
export type Translate = (key: MessageKey) => string;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function lookup(dict: Dict, key: string): string | null {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  return typeof node === "string" ? node : null;
}

// Одна функция перевода на язык. Если в казахском словаре строки нет, показываем русскую.
const translators = {} as Record<Locale, Translate>;
export function translator(locale: Locale): Translate {
  translators[locale] ??= (key) => lookup(DICTS[locale], key) ?? lookup(ru, key) ?? key;
  return translators[locale];
}

// Русский текст для того, что не зависит от языка экрана: сообщения в Telegram,
// подсказки и запасные тексты ИИ, записи в базе.
export const tRu: Translate = translator("ru");
