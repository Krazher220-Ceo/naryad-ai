// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import "server-only";
import { findAnomalies } from "@/lib/analytics/anomalies";
import { getRating } from "@/lib/analytics/rating";
import { tRu, translator, type Locale, type MessageKey, type Translate } from "@/lib/i18n";
import { getMasterBoard } from "@/lib/orders/queries";
import { createAnonymizer } from "./anonymize";
import { chatJson } from "./provider";
import { provider } from "./summaries";

// Чат-помощник мастера. Цифры и списки собирает код: доска смены, аномалии, рейтинг.
// Модель получает готовые факты и только отвечает на вопрос словами. Ничего не считает и не придумывает.
// ФИО заменяются на метки до отправки и подставляются обратно после ответа.
// Без модели отвечает шаблон по ключевым словам вопроса.
// Факты для модели всегда на русском, отвечает она на языке интерфейса.

export type AssistantTurn = { role: "user" | "assistant"; text: string };
export type AssistantAnswer = { answer: string; source: "llm" | "rules" };

const MAX_QUESTION = 500;
const MAX_TURNS = 6;
const DAY = 24 * 60 * 60 * 1000;

const SYSTEM = `Ты помощник мастера смены ремонтной службы горно-обогатительного предприятия.
Тебе дают факты, которые посчитала программа: исполнители и их статусы, открытые наряды, найденные аномалии, рейтинг исполнителей.
Отвечай только по этим фактам. Не пересчитывай и не придумывай цифры, людей, наряды и оборудование.
Если в фактах нет ответа, так и скажи и подскажи, где посмотреть (отчёт за смену, рейтинг, аномалии).
Решение всегда принимает мастер: ты советуешь, а не приказываешь.
Пиши коротко, простыми словами, 1–5 предложений или короткий список. Номера нарядов пиши со знаком №.
Ответ строго JSON: {"answer": "..."}`;

const time = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Факты для ответа. Всё посчитано здесь, в коде.
async function collectFacts() {
  const t = tRu;
  const now = new Date();
  const [board, anomalies, rating] = await Promise.all([
    getMasterBoard(),
    // Тексты аномалий — по шаблону, без второго вызова модели.
    findAnomalies(30, false).then((r) => r.anomalies.slice(0, 7)),
    getRating(new Date(now.getTime() - 30 * DAY), now),
  ]);

  const workers = board.workers.map((w) => ({
    name: w.full_name ?? "",
    specialty: w.specialty,
    brigade: w.brigade,
    status: t(`workers.status.${w.board_status}` as MessageKey),
    currentOrder: w.current_order_number,
    queue: w.queue_count ?? 0,
  }));
  const orders = board.orders.map((o) => ({
    number: o.number,
    type: t(`orders.type.${o.type}` as MessageKey),
    priority: t(`orders.priority.${o.priority}` as MessageKey),
    status: t(`orders.status.${o.status}` as MessageKey),
    equipment: o.equipment?.name ?? null,
    section: o.section?.name ?? null,
    assignee: o.assignee?.full_name ?? null,
    due: time(o.due_at),
    overdue: o.overdue,
    description: o.description.slice(0, 160),
  }));
  const rated = rating.filter((r) => !r.lowData).sort((a, b) => b.total - a.total);

  return {
    now: time(now.toISOString()),
    counters: {
      openOrders: orders.length,
      overdue: orders.filter((o) => o.overdue).length,
      emergency: board.orders.filter((o) => o.priority === "emergency").length,
      freeWorkers: board.workers.filter((w) => w.board_status === "free").length,
    },
    workers,
    orders,
    anomalies: anomalies.map((a) => ({ kind: a.kind, subject: a.subject, text: a.text, recommendation: a.recommendation })),
    rating30days: rated.map((r) => ({ name: r.fullName, score: r.total, closedOrders: r.closedOrders })),
    // Для запасного ответа без модели.
    raw: { board, rated },
  };
}

type Facts = Awaited<ReturnType<typeof collectFacts>>;

export async function answerQuestion(question: string, history: AssistantTurn[], locale: Locale): Promise<AssistantAnswer> {
  const q = question.trim().slice(0, MAX_QUESTION);
  const facts = await collectFacts();
  const { raw, ...forModel } = facts;

  const names = [...facts.workers.map((w) => w.name), ...facts.rating30days.map((r) => r.name)]
    .filter((n, i, all) => n && all.indexOf(n) === i);
  const anon = createAnonymizer(names);

  const dialog = history.slice(-MAX_TURNS).map((turn) => ({ role: turn.role, text: turn.text.slice(0, MAX_QUESTION) }));
  const payload = JSON.stringify({ facts: forModel, dialog, question: q });

  const res = await chatJson({
    cloudFallback: true, // данные уже обезличены
    provider: await provider(),
    system: `${SYSTEM}\n${locale === "kk" ? "Отвечай на казахском языке." : "Отвечай на русском языке."}`,
    user: anon.hide(payload),
    validate: (v) => {
      const answer = (v as { answer?: unknown } | null)?.answer;
      return typeof answer === "string" && answer.trim() ? { answer: answer.trim() } : null;
    },
    timeoutMs: 20000,
    maxTokens: 1200,
  });
  if (res.ok) return { answer: anon.restore(res.data.answer), source: "llm" };
  return { answer: rulesAnswer(translator(locale), q, facts, raw), source: "rules" };
}

// Запасной ответ без модели: тема вопроса определяется по ключевым словам.
function rulesAnswer(t: Translate, question: string, facts: Facts, raw: Facts["raw"]): string {
  const q = question.toLowerCase();
  const list = (items: string[]) => (items.length > 0 ? items.join("\n") : t("assistant.rules.none"));
  const orderLine = (o: Facts["orders"][number]) =>
    `№${o.number} — ${o.equipment ?? "—"}, ${o.status.toLowerCase()}${o.assignee ? `, ${o.assignee}` : ""}`;

  if (/свобод|кого|назнач|бос/.test(q)) {
    const free = raw.board.workers.filter((w) => w.board_status === "free").map((w) => `${w.full_name} (${w.specialty ?? "—"})`);
    return `${t("assistant.rules.free")}\n${list(free)}`;
  }
  if (/просроч|срок|кешік/.test(q)) {
    return `${t("assistant.rules.overdue")}\n${list(facts.orders.filter((o) => o.overdue).map(orderLine))}`;
  }
  if (/авари|апат/.test(q)) {
    const emergency = raw.board.orders.filter((o) => o.priority === "emergency").map((o) => o.number);
    return `${t("assistant.rules.emergency")}\n${list(facts.orders.filter((o) => emergency.includes(o.number)).map(orderLine))}`;
  }
  if (/аномал|ломает|чаще|законо|отказ|оборудован|жабдық/.test(q)) {
    return `${t("assistant.rules.anomalies")}\n${list(facts.anomalies.slice(0, 3).map((a) => `• ${a.text} ${a.recommendation}`))}`;
  }
  if (/рейтинг|лучш|худш|үздік/.test(q)) {
    const top = raw.rated.slice(0, 3).map((r) => `${r.fullName} — ${r.total}`);
    return `${t("assistant.rules.rating")}\n${list(top)}`;
  }
  return t("assistant.rules.summary")
    .replace("{open}", String(facts.counters.openOrders))
    .replace("{overdue}", String(facts.counters.overdue))
    .replace("{emergency}", String(facts.counters.emergency))
    .replace("{free}", String(facts.counters.freeWorkers));
}
