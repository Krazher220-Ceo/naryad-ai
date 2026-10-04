"use server";

import { answerQuestion, type AssistantAnswer, type AssistantTurn } from "@/lib/ai/assistant";
import { getCurrentEmployee } from "@/lib/auth/session";
import { getLocale, getT } from "@/lib/i18n-server";
import type { ActionResult } from "@/lib/orders/types";

// Вопрос помощнику. Отвечать может только мастер: данные смены видит он.
export async function askAssistant(question: string, history: AssistantTurn[]): Promise<ActionResult<AssistantAnswer>> {
  const t = await getT();
  const me = await getCurrentEmployee();
  if (me?.role !== "master") return { ok: false, error: t("orders.errors.forbidden") };
  if (!question.trim()) return { ok: false, error: t("assistant.error") };
  try {
    return { ok: true, data: await answerQuestion(question, history, await getLocale()) };
  } catch {
    return { ok: false, error: t("assistant.error") };
  }
}
