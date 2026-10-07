// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { tRu as t } from "@/lib/i18n";

// Проверки, которые выполняет код, а не модель (AGENTS.md: «считает код»).
// Чистые функции без базы и сети: на вход — факты о наряде, на выход — список проверок.

export type CheckStatus = "ok" | "warn" | "fail";
export type RuleCheck = { id: string; status: CheckStatus; message: string };

export type RuleInput = {
  type: "planned" | "unplanned";
  workDone: string | null;
  faultCode: string | null;
  normHours: number | null;
  startedAt: string | null;
  doneAt: string | null;
  dueAt: string;
  excusedPauseMinutes: number; // паузы «ждёт запчасть / допуск / остановку» не считаем
  afterPhotos: number;
  duplicatePhotos: number; // фото «после», которые уже встречались в других нарядах
  materials: { name: string; unit: string; qty: number; typicalQty: number; faultCodes: string[] }[];
};

// Подстановка значений в текст словаря: "{name} …" -> "Подшипник …".
function fill(key: Parameters<typeof t>[0], values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [k, v]) => text.split(`{${k}}`).join(String(v)), t(key));
}

const minutesBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 60000;

export function runRules(input: RuleInput): RuleCheck[] {
  const checks: RuleCheck[] = [];

  // 1. Полнота закрытия.
  if (!input.workDone?.trim()) checks.push({ id: "work_done", status: "fail", message: t("ai.rules.noWorkDone") });
  if (!input.faultCode) checks.push({ id: "fault_code", status: "fail", message: t("ai.rules.noFaultCode") });
  if (input.afterPhotos === 0) {
    // Для внеплановых фото обязательно (база и так не даст закрыть без него), для плановых — замечание.
    checks.push({
      id: "after_photo",
      status: input.type === "unplanned" ? "fail" : "warn",
      message: t("ai.rules.noAfterPhoto"),
    });
  }

  // 2. Повтор старого фото.
  if (input.duplicatePhotos > 0) {
    checks.push({ id: "photo_duplicate", status: "fail", message: t("ai.rules.duplicatePhoto") });
  }

  // 3. Логичность материалов: расход против обычного и связь с шифром.
  for (const m of input.materials) {
    const ratio = m.typicalQty > 0 ? m.qty / m.typicalQty : 1;
    const values = { name: m.name, qty: m.qty, unit: m.unit, typical: m.typicalQty, ratio: ratio.toFixed(1) };
    if (ratio > 2) checks.push({ id: `material_over:${m.name}`, status: "fail", message: fill("ai.rules.materialOver", values) });
    else if (ratio > 1.5) checks.push({ id: `material_high:${m.name}`, status: "warn", message: fill("ai.rules.materialHigh", values) });
    if (input.faultCode && m.faultCodes.length > 0 && !m.faultCodes.includes(input.faultCode)) {
      checks.push({
        id: `material_unrelated:${m.name}`,
        status: "warn",
        message: fill("ai.rules.materialUnrelated", { name: m.name, code: input.faultCode }),
      });
    }
  }

  // 4. Время: фактическое против норматива и срока.
  if (input.startedAt && input.doneAt) {
    const actual = Math.max(0, minutesBetween(input.startedAt, input.doneAt) - input.excusedPauseMinutes);
    if (input.normHours) {
      const norm = input.normHours * 60;
      const values = { actual: Math.round(actual), norm: Math.round(norm) };
      if (actual > norm * 1.5) checks.push({ id: "time_long", status: "warn", message: fill("ai.rules.timeLong", values) });
      else if (actual < norm * 0.2) checks.push({ id: "time_short", status: "warn", message: fill("ai.rules.timeShort", values) });
      else checks.push({ id: "time_ok", status: "ok", message: fill("ai.rules.timeOk", values) });
    }
    const late = minutesBetween(input.dueAt, input.doneAt);
    if (late > 0) checks.push({ id: "late", status: "warn", message: fill("ai.rules.late", { minutes: Math.round(late) }) });
  }

  if (!checks.some((c) => c.status !== "ok")) {
    checks.push({ id: "complete", status: "ok", message: t("ai.rules.allFilled") });
  }
  return checks;
}

// Оценка по правилам: 5 баллов минус 2 за каждую ошибку и 0,5 за каждое замечание.
export function rulesScore(checks: RuleCheck[]): number {
  const penalty = checks.reduce((sum, c) => sum + (c.status === "fail" ? 2 : c.status === "warn" ? 0.5 : 0), 0);
  return Math.min(5, Math.max(1, Math.round(5 - penalty)));
}
