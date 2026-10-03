// Склеивает классы и пропускает пустые значения: cx("a", ok && "b").
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
