import type { Translate } from "@/lib/i18n";
import ru from "@/messages/ru.json";

// Мелкие помощники форматирования для отчётов.

export const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), template);

// Число с запятой: 2,5.
export const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

export const PERIODS = [7, 30, 90] as const;
export type Days = (typeof PERIODS)[number];

// Разбор ?days=...: допустимы только значения из списка, иначе берётся запасное.
export function parseDaysIn(value: string | string[] | undefined, allowed: readonly number[], fallback: number): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return allowed.find((p) => p === n) ?? fallback;
}

// Название категории шифра по первой букве: М → «Механика».
export function categoryLabel(t: Translate, letter: string | null): string {
  if (!letter) return t("downtimeReport.noCause");
  const key = letter in ru.faultCategory ? (letter as keyof typeof ru.faultCategory) : "?";
  return t(`faultCategory.${key}`);
}

// Подписи цифр аномалий. Ключи фактов задаёт lib/analytics/anomalies.
const isFactKey = (key: string): key is keyof typeof ru.anomalies.fact => key in ru.anomalies.fact;

export function factLabel(t: Translate, key: string): string {
  return isFactKey(key) ? t(`anomalies.fact.${key}`) : key;
}

export function factValue(t: Translate, key: string, value: number | string): string {
  if (typeof value === "number") return oneDecimal(value);
  if (key === "shift" && (value === "night" || value === "day")) return t(`anomaly.shiftName.${value}`);
  if (value === "*") return t("anomaly.allEquipment");
  return value;
}
