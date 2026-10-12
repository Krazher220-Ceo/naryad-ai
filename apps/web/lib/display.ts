// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
// Размер текста из профиля. Cookie читает корневой layout и ставит <html data-text-size="...">,
// поэтому страница сразу рисуется нужного размера, без мигания.
export const TEXT_SIZE_COOKIE = "text_size";
// Старая настройка «Крупный текст»: если она осталась в cookie, считаем её размером «крупный».
export const BIG_TEXT_COOKIE = "big_text";

export const TEXT_SIZES = ["sm", "md", "lg", "xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export function parseTextSize(value: string | undefined, legacyBig: string | undefined): TextSize {
  if ((TEXT_SIZES as readonly string[]).includes(value ?? "")) return value as TextSize;
  return legacyBig === "1" ? "lg" : "md";
}
