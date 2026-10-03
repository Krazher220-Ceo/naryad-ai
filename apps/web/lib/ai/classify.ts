import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatJson, type AiProvider } from "./provider";

// Подсказка по описанию проблемы: шифр неисправности, приоритет, специальность (п. 5.1.4 кейса).
//
// Путь 1 — Laya (services/fast-ai): ~0,1 с, но без дообучения на русском точность низкая
//   (docs/laya-eval.md), поэтому включается только переменной LAYA_ENABLED=1.
// Путь 2 — языковая модель через lib/ai (~2 с), выбирает точный шифр из справочника.
// Если оба недоступны — подсказки нет, мастер выбирает сам. Выдачу наряда это не останавливает.

export type Specialty = "слесарь" | "электрик" | "сварщик";
export type Classification = {
  faultCode: string | null; // точный шифр (только у языковой модели)
  category: string | null; // М/Э/Г/П/С
  priority: "emergency" | "high" | "normal" | "planned" | null;
  specialty: Specialty | null;
  confidence: number;
  source: "laya" | "llm";
};

const PRIORITIES = ["emergency", "high", "normal", "planned"] as const;
const SPECIALTIES: Specialty[] = ["слесарь", "электрик", "сварщик"];
const LAYA_TIMEOUT_MS = 1500; // PLAN.md: Laya не должна тормозить выдачу

async function viaLaya(description: string): Promise<Classification | null> {
  const url = process.env.FAST_AI_URL;
  if (process.env.LAYA_ENABLED !== "1" || !url) return null;
  try {
    const res = await fetch(`${url}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.FAST_AI_SECRET ?? ""}` },
      body: JSON.stringify({ description }),
      signal: AbortSignal.timeout(LAYA_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    type Answer = { choice: string; probabilities: Record<string, number> };
    const data = (await res.json()) as { category: Answer; priority: Answer; specialty: Answer };
    const p = (a: Answer) => a.probabilities[a.choice] ?? 0;
    return {
      faultCode: null,
      category: data.category.choice,
      priority: (PRIORITIES as readonly string[]).includes(data.priority.choice) ? (data.priority.choice as Classification["priority"]) : null,
      specialty: SPECIALTIES.includes(data.specialty.choice as Specialty) ? (data.specialty.choice as Specialty) : null,
      confidence: Math.min(p(data.category), p(data.priority), p(data.specialty)),
      source: "laya",
    };
  } catch {
    return null; // таймаут или сервис выключен — идём к языковой модели
  }
}

async function viaLlm(description: string): Promise<Classification | null> {
  const db = createAdminClient();
  const [{ data: codes }, { data: settings }] = await Promise.all([
    db.from("fault_codes").select("code, name").order("code"),
    db.from("settings").select("ai_provider").eq("id", 1).single(),
  ]);
  const list = (codes ?? []).map((c) => `${c.code} ${c.name}`).join("; ");

  const res = await chatJson({
    provider: (settings?.ai_provider ?? process.env.AI_PROVIDER ?? "cloud") as AiProvider,
    system:
      `Классифицируй заявку на ремонт оборудования горно-обогатительного предприятия.\n` +
      `Шифры: ${list}.\n` +
      `priority: emergency — оборудование остановлено или опасно; high — работает, но быстро ухудшается; ` +
      `normal — мелкий дефект; planned — плановые работы.\n` +
      `specialty: слесарь — механика, гидравлика, пневматика, смазка; электрик — электрика; сварщик — сварка, трещины.\n` +
      `Ответ строго JSON: {"fault_code": "код из списка", "priority": "...", "specialty": "...", "confidence": 0..1}`,
    user: description,
    validate: (v) => {
      if (typeof v !== "object" || v === null) return null;
      const o = v as Record<string, unknown>;
      const code = (codes ?? []).find((c) => c.code === o.fault_code)?.code ?? null;
      if (!(PRIORITIES as readonly unknown[]).includes(o.priority) || !SPECIALTIES.includes(o.specialty as Specialty)) return null;
      const confidence = typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : 0.5;
      return { code, priority: o.priority as Classification["priority"], specialty: o.specialty as Specialty, confidence };
    },
    timeoutMs: 12000,
    maxTokens: 1000,
  });
  if (!res.ok) return null;
  return {
    faultCode: res.data.code,
    category: res.data.code ? res.data.code[0] : null,
    priority: res.data.priority,
    specialty: res.data.specialty,
    confidence: res.data.confidence,
    source: "llm",
  };
}

export async function classifyProblem(description: string): Promise<Classification | null> {
  if (description.trim().length < 5) return null;
  return (await viaLaya(description)) ?? (await viaLlm(description));
}
