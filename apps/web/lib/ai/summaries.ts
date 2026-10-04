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

export async function provider(): Promise<AiProvider> {
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

// ---------- Аномалии ----------

type AnomalyDraft = { id: string; kind: string; subject: string; facts: Record<string, number | string> };
type AnomalyText = { text: string; recommendation: string; source: "llm" | "rules" };

const ANOMALY_SYSTEM = `Ты аналитик ремонтной службы горно-обогатительного предприятия.
Тебе дают карточки аномалий: вид, объект и готовые цифры. Не пересчитывай и не добавляй цифр, которых нет.
Для каждой карточки напиши по-русски:
- text: вывод одним-двумя предложениями с цифрами из карточки;
- recommendation: одна конкретная рекомендация мастеру или главному механику.
Виды: problem_equipment — ломается чаще однотипного; repeat_fault — один шифр повторяется, ремонт не устраняет причину;
after_planned — поломки вскоре после планового ремонта (качество ППР); shift — поломок больше в ночную смену;
worker_returns — у исполнителя много возвратов на доработку; material_overuse — перерасход материала;
failure_trend — рост внеплановых нарядов, вероятен отказ.
Ответ строго JSON: {"items": [{"id": "...", "text": "...", "recommendation": "..."}]}`;

function fillFacts(template: string, values: Record<string, number | string>): string {
  return Object.entries(values).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), template);
}

// Запасной текст без модели: шаблон вида аномалии из словаря.
function anomalyFallback(d: AnomalyDraft): AnomalyText {
  const values: Record<string, number | string> = { subject: d.subject, ...d.facts };
  if (values.peers === "*") values.peers = t("anomaly.allEquipment");
  if (values.shift === "night" || values.shift === "day") values.shift = t(`anomaly.shiftName.${values.shift}`);
  const key = d.kind as "problem_equipment";
  return {
    text: fillFacts(t(`anomaly.${key}.text`), values),
    recommendation: fillFacts(t(`anomaly.${key}.recommendation`), values),
    source: "rules",
  };
}

// useModel = false — только тексты по шаблону, без вызова модели (например, для чата-помощника).
export async function describeAnomalies(drafts: AnomalyDraft[], useModel = true): Promise<Record<string, AnomalyText>> {
  const result: Record<string, AnomalyText> = {};
  for (const d of drafts) result[d.id] = anomalyFallback(d);
  if (drafts.length === 0 || !useModel) return result;

  // Имена исполнителей в карточках обезличиваем.
  const anon = createAnonymizer(drafts.filter((d) => d.kind === "worker_returns").map((d) => d.subject));
  const res = await chatJson({
    provider: await provider(),
    system: ANOMALY_SYSTEM,
    user: anon.hide(JSON.stringify(drafts.map((d) => ({ id: d.id, kind: d.kind, subject: d.subject, facts: d.facts })))),
    validate: (v) => {
      const items = (v as { items?: unknown }).items;
      if (!Array.isArray(items)) return null;
      const ok = items.filter(
        (i): i is { id: string; text: string; recommendation: string } =>
          typeof i?.id === "string" && typeof i?.text === "string" && typeof i?.recommendation === "string",
      );
      return ok.length > 0 ? ok : null;
    },
    timeoutMs: 30000,
    maxTokens: 3000,
  });
  if (res.ok) {
    for (const item of res.data) {
      if (result[item.id]) {
        result[item.id] = { text: anon.restore(item.text), recommendation: anon.restore(item.recommendation), source: "llm" };
      }
    }
  }
  return result;
}
