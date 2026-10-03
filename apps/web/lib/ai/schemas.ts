// Схемы ответов модели и их проверка. Без библиотек: каждая функция проверяет поля руками
// и возвращает готовый объект или null, если модель ответила не по схеме.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum01 = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;
const strings = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null;

// ---------- Соответствие выполненных работ описанной проблеме (текст) ----------

export type WorkMatch = { matches: boolean; confidence: number; explanation: string };

export function validateWorkMatch(v: unknown): WorkMatch | null {
  if (!isObj(v)) return null;
  if (typeof v.matches !== "boolean" || !isNum01(v.confidence) || typeof v.explanation !== "string") return null;
  return { matches: v.matches, confidence: v.confidence, explanation: v.explanation };
}

// ---------- Фото «до» и «после» (раздел 7 PLAN.md) ----------

export type PhotoVerdict = "accept" | "accept_with_note" | "rework" | "needs_master";

export type PhotoCheck = {
  same_equipment: { value: boolean | null; confidence: number; evidence: string };
  visible_problem_before: string;
  visible_problem_after: string;
  repair_visible: boolean | null;
  quality_findings: string[];
  cannot_verify: string[];
  score: number; // 1–5
  confidence: number;
  verdict: PhotoVerdict;
};

const VERDICTS: PhotoVerdict[] = ["accept", "accept_with_note", "rework", "needs_master"];

export function validatePhotoCheck(v: unknown): PhotoCheck | null {
  if (!isObj(v) || !isObj(v.same_equipment)) return null;
  const se = v.same_equipment;
  const findings = strings(v.quality_findings);
  const cannot = strings(v.cannot_verify);
  const boolOrNull = (x: unknown) => typeof x === "boolean" || x === null;
  if (
    !boolOrNull(se.value) ||
    !isNum01(se.confidence) ||
    typeof se.evidence !== "string" ||
    typeof v.visible_problem_before !== "string" ||
    typeof v.visible_problem_after !== "string" ||
    !boolOrNull(v.repair_visible) ||
    !findings ||
    !cannot ||
    typeof v.score !== "number" ||
    v.score < 1 ||
    v.score > 5 ||
    !isNum01(v.confidence) ||
    !VERDICTS.includes(v.verdict as PhotoVerdict)
  ) {
    return null;
  }
  return {
    same_equipment: { value: se.value as boolean | null, confidence: se.confidence, evidence: se.evidence },
    visible_problem_before: v.visible_problem_before,
    visible_problem_after: v.visible_problem_after,
    repair_visible: v.repair_visible as boolean | null,
    quality_findings: findings,
    cannot_verify: cannot,
    score: Math.round(v.score),
    confidence: v.confidence,
    verdict: v.verdict as PhotoVerdict,
  };
}

// ---------- Пояснение для людей ----------

export type ReviewText = { good: string[]; improve: string[]; summary: string };

export function validateReviewText(v: unknown): ReviewText | null {
  if (!isObj(v)) return null;
  const good = strings(v.good);
  const improve = strings(v.improve);
  if (!good || !improve || typeof v.summary !== "string") return null;
  return { good, improve, summary: v.summary };
}
