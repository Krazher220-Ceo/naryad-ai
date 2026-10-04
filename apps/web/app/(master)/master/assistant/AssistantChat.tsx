"use client";

import { useState } from "react";
import { Button, Card, InlineNotice, TextArea, VoiceButton, appendSpoken, cx } from "@/components/ui";
import type { AssistantTurn } from "@/lib/ai/assistant";
import { type MessageKey } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";
import { askAssistant } from "./actions";

type Message = AssistantTurn & { source?: "llm" | "rules" };

const EXAMPLES = ["free", "overdue", "anomalies", "priority"] as const;

// Переписка с помощником. История живёт только на этой странице и уходит с каждым вопросом,
// чтобы помощник понимал уточнения вроде «а у кого из них очередь?».
export function AssistantChat() {
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const history: AssistantTurn[] = messages.map(({ role, text }) => ({ role, text }));
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setError(null);
    setPending(true);
    try {
      const res = await askAssistant(q, history);
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: res.data.answer, source: res.data.source }]);
      } else {
        setError(res.error);
      }
    } catch {
      setError(t("assistant.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:max-w-2xl">
      <p className="text-base text-ink-muted">{t("assistant.intro")}</p>

      {messages.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-ink">{t("assistant.examplesTitle")}</p>
          {EXAMPLES.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => ask(t(`assistant.examples.${key}` as MessageKey))}
              className="min-h-touch rounded-xl border-2 border-line-strong bg-surface px-4 text-left text-base font-semibold text-ink hover:bg-canvas active:bg-line"
            >
              {t(`assistant.examples.${key}` as MessageKey)}
            </button>
          ))}
        </div>
      )}

      <ol className="flex flex-col gap-3" aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <Card className={cx("flex max-w-[90%] flex-col gap-1", m.role === "user" && "bg-canvas")}>
              <span className="text-sm font-bold text-ink-muted">{m.role === "user" ? t("assistant.you") : t("assistant.bot")}</span>
              <p className="whitespace-pre-line text-base leading-relaxed text-ink">{m.text}</p>
              {m.source && (
                <span className="text-sm text-ink-muted">
                  {t("assistant.sourceLabel").replace("{source}", t(`ai.source.${m.source}` as MessageKey))}
                </span>
              )}
            </Card>
          </li>
        ))}
        {pending && (
          <li role="status" className="text-base font-semibold text-ink-muted">
            {t("assistant.thinking")}
          </li>
        )}
      </ol>

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="assistant-question" className="sr-only">
          {t("assistant.placeholder")}
        </label>
        <TextArea
          id="assistant-question"
          rows={2}
          placeholder={t("assistant.placeholder")}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <VoiceButton onText={(spoken) => setQuestion((prev) => appendSpoken(prev, spoken))} />
        <Button type="submit" fullWidth loading={pending} disabled={!question.trim()}>
          {t("assistant.send")}
        </Button>
      </form>
    </div>
  );
}
