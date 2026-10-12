// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useRef, useState } from "react";
import { Button, IconCheck, IconInfo, InlineNotice, Skeleton, TextInput, cx } from "@/components/ui";
import { useT } from "@/components/LocaleProvider";
import { type MessageKey } from "@/lib/i18n";
import { expressIssue } from "@/lib/orders/actions";
import type { Classification } from "@/lib/ai/classify";
import type { SpeechFields } from "@/lib/ai/voice";
import type { Candidate } from "@/lib/orders/suggest";

export type ExpressResult = {
  fields: SpeechFields;
  classification: Classification | null;
  candidates: Candidate[];
};

// Какие поля формы реально заполнены: форма сообщает это после применения результата.
export type ExpressFilled = {
  equipment: boolean;
  priority: boolean;
  faultCode: boolean;
  assignee: boolean;
};

const DEMOS = [
  { label: "master.express.demo.pump.label", text: "master.express.demo.pump.text" },
  { label: "master.express.demo.conveyor.label", text: "master.express.demo.conveyor.text" },
  { label: "master.express.demo.crusher.label", text: "master.express.demo.crusher.text" },
] as const satisfies readonly { label: MessageKey; text: MessageKey }[];

const FILLED_LABELS = [
  ["equipment", "master.express.filled.equipment"],
  ["priority", "master.express.filled.priority"],
  ["faultCode", "master.express.filled.faultCode"],
  ["assignee", "master.express.filled.assignee"],
] as const satisfies readonly (readonly [keyof ExpressFilled, MessageKey])[];

type Outcome =
  | { kind: "ok"; result: ExpressResult; filled: ExpressFilled }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export function LayaExpress({
  onResult,
}: {
  // Форма применяет результат и возвращает, какие поля заполнила.
  onResult: (phrase: string, result: ExpressResult) => ExpressFilled;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  async function run(phrase: string) {
    const trimmed = phrase.trim();
    if (trimmed.length < 5 || loading) return;
    setLoading(true);
    setOutcome(null);
    try {
      const res = await expressIssue(trimmed);
      if (!res.ok) {
        setOutcome({ kind: "error", message: res.error });
        return;
      }
      const filled = onResult(trimmed, res.data);
      if (!Object.values(filled).some(Boolean)) {
        setOutcome({ kind: "empty" });
        return;
      }
      setOutcome({ kind: "ok", result: res.data, filled });
      // Показываем блок с итогом; без анимации, если пользователь просил меньше движения.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rootRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    } catch {
      setOutcome({ kind: "error", message: t("master.express.errors.failed") });
    } finally {
      setLoading(false);
    }
  }

  function runDemo(textKey: MessageKey) {
    const phrase = t(textKey);
    setText(phrase);
    void run(phrase);
  }

  return (
    <section
      ref={rootRef}
      aria-labelledby="laya-express-title"
      className="scroll-mt-4 rounded-2xl border border-line bg-surface p-4 lg:p-5"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="laya-express-title" className="text-xl font-bold text-ink lg:text-lg">
            {t("master.express.title")}
          </h2>
          <span className="shrink-0 rounded-md border border-brand px-2 py-0.5 text-sm font-semibold text-brand">
            {t("master.express.model")}
          </span>
        </div>
        <p className="text-base text-ink-muted">{t("master.express.hint")}</p>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          <TextInput
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter запускает разбор и не отправляет форму выдачи
              if (e.key === "Enter") {
                e.preventDefault();
                void run(text);
              }
            }}
            placeholder={t("master.express.placeholder")}
            aria-label={t("master.express.label")}
            maxLength={500}
            disabled={loading}
            className="lg:flex-1"
          />
          <Button
            onClick={() => void run(text)}
            disabled={loading || text.trim().length < 5}
            loading={loading}
            className="w-full lg:w-auto lg:shrink-0"
          >
            {loading ? t("master.express.running") : t("master.express.run")}
          </Button>
        </div>

        {loading && (
          <div className="flex flex-col gap-2" role="status" aria-live="polite">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink-muted">{t("master.express.examples")}</p>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            {DEMOS.map((d) => (
              <button
                key={d.label}
                type="button"
                disabled={loading}
                onClick={() => runDemo(d.text)}
                className="min-h-touch rounded-xl border-2 border-line-strong bg-canvas px-4 text-left text-base font-semibold text-ink hover:bg-line active:bg-line disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-touch-sm"
              >
                {t(d.label)}
              </button>
            ))}
          </div>
        </div>

        {outcome?.kind === "error" && <InlineNotice tone="warning">{outcome.message}</InlineNotice>}
        {outcome?.kind === "empty" && <InlineNotice tone="warning">{t("master.express.errors.nothing")}</InlineNotice>}
        {outcome?.kind === "ok" && <Summary result={outcome.result} filled={outcome.filled} />}
      </div>
    </section>
  );
}

function Summary({ result, filled }: { result: ExpressResult; filled: ExpressFilled }) {
  const t = useT();
  const { classification, fields } = result;

  // Без ответа моделей уверенность не показываем: её нет, только ключевые слова.
  const modelUsed = classification !== null || fields.source === "llm";
  const confidence = Math.round(Math.max(classification?.confidence ?? 0, fields.source === "llm" ? fields.confidence : 0) * 100);

  const title = !modelUsed
    ? t("master.express.badge.rules")
    : t(classification ? (classification.source === "laya" ? "master.express.badge.laya" : "master.express.badge.llm") : "master.express.badge.partial");
  const rows: [MessageKey, string][] = [];
  if (classification?.category) rows.push(["master.express.result.category", t(`faultCategory.${classification.category}` as MessageKey)]);
  if (classification?.specialty) rows.push(["master.express.result.specialty", t(`master.express.specialty.${classification.specialty}` as MessageKey)]);
  if (modelUsed) rows.push(["master.express.result.confidence", `${confidence}%`]);

  return (
    <div className="laya-in flex flex-col gap-3">
      <div role="status" className={cx("rounded-xl border p-4", modelUsed ? "border-success bg-success-soft" : "border-accent-ink bg-warning-soft")}>
        <p className="flex items-center gap-2 text-base font-bold text-ink">
          {modelUsed ? <IconCheck className="size-5 shrink-0 text-success" /> : <IconInfo className="size-5 shrink-0" />}
          {title}
        </p>
        {rows.length > 0 && (
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 sm:flex-col sm:justify-start sm:gap-0.5">
                <dt className="text-sm text-ink-muted">{t(label)}</dt>
                <dd className="text-base font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink-muted">{t("master.express.filled.title")}:</span>
        {FILLED_LABELS.filter(([key]) => filled[key]).map(([key, label]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full border border-success bg-surface px-3 py-1 text-sm font-semibold text-ink"
          >
            {t(label)}
            <IconCheck className="size-4 text-success" />
          </span>
        ))}
      </div>
      <p className="text-base font-semibold text-ink">{t("master.express.next")}</p>
    </div>
  );
}
