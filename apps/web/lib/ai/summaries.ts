import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { t } from "@/lib/i18n";
import { createAnonymizer } from "./anonymize";
import { chatJson, type AiProvider } from "./provider";

// Текстовые сводки по готовым цифрам. Модель ничего не считает, только формулирует.
// Без модели сводку собирает шаблон: отчёт всё равно открывается.

type SummaryText = { summary: string; source: "llm" | "rules" };

const SHIFT_SYSTEM = `Ты помощник мастера смены на горно-обогатительном предприятии.
Тебе дают готовые цифры смены. Не пересчитывай. Упоминай только показатели из входных данных:
выдано, выполнено, просрочено, отклонено, аварийные, загрузка людей, простой. Других показателей не придумывай.
Напиши 2–3 коротких предложения по-русски: итог смены, главная проблема, что сделать в следующей смене.
Ответ строго JSON: {"summary": "..."}`;

const validateSummary = (v: unknown): { summary: string } | null =>
  typeof v === "object" && v !== null && typeof (v as { summary?: unknown }).summary === "string"
    ? { summary: (v as { summary: string }).summary }
    : null;

async function provider(): Promise<AiProvider> {
  const { data } = await createAdminClient().from("settings").select("ai_provider").eq("id", 1).single();
  return (data?.ai_provider ?? process.env.AI_PROVIDER ?? "cloud") as AiProvider;
}

export async function summarizeShift(facts: {
  date: string;
  shift: "A" | "B";
  counters: { issued: number; done: number; overdue: number; rejected: number; emergency: number };
  load: { name: string; done: number; normHours: number }[];
  downtime: { name: string; minutes: number }[];
}): Promise<SummaryText> {
  const anon = createAnonymizer(facts.load.map((l) => l.name));
  const res = await chatJson({
    provider: await provider(),
    system: SHIFT_SYSTEM,
    user: anon.hide(JSON.stringify(facts)),
    validate: validateSummary,
    timeoutMs: 15000,
    maxTokens: 800,
  });
  if (res.ok) return { summary: anon.restore(res.data.summary), source: "llm" };

  // Запасной вариант без модели.
  const c = facts.counters;
  const top = facts.downtime[0];
  const text = t("analytics.shiftFallback")
    .replace("{issued}", String(c.issued))
    .replace("{done}", String(c.done))
    .replace("{overdue}", String(c.overdue))
    .replace("{rejected}", String(c.rejected))
    .replace(
      "{downtime}",
      top ? t("analytics.downtimeItem").replace("{name}", top.name).replace("{minutes}", String(top.minutes)) : "—",
    );
  return { summary: text, source: "rules" };
}
