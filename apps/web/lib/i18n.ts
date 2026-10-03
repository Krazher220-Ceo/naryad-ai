import ru from "@/messages/ru.json";

// Словарь надписей. Позже добавится kk.json с той же структурой.
type Dict = typeof ru;

// Ключи вида "auth.title": собираются из структуры словаря.
type Path<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : Path<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Path<Dict>;

export function t(key: MessageKey): string {
  let node: unknown = ru;
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : key;
}
