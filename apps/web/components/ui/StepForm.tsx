"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { BottomActionBar } from "./BottomActionBar";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconChevronLeft } from "./icons";

export type Step = {
  id: string;
  title: string;
  content: React.ReactNode;
  // false — шаг не заполнен, дальше не пускаем. По умолчанию шаг готов.
  valid?: boolean;
};

type StepFormProps = {
  steps: Step[];
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
};

// Одна форма, две раскладки.
// Телефон (до md): по одному шагу, «Назад» и «Далее» внизу экрана.
// Ноутбук (от md): все шаги одной страницей и одна кнопка отправки.
export function StepForm({ steps, submitLabel, onSubmit, loading }: StepFormProps) {
  const [current, setCurrent] = useState(0);
  const isLast = current === steps.length - 1;
  const currentValid = steps[current]?.valid !== false;
  const allValid = steps.every((s) => s.valid !== false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (allValid) onSubmit();
      }}
      className="flex flex-col gap-6 pb-40 md:pb-0"
    >
      {/* Прогресс только на телефоне */}
      <div className="flex flex-col gap-2 md:hidden">
        <p className="text-base font-semibold text-ink-muted">
          {t("ui.form.stepOf").replace("{current}", String(current + 1)).replace("{total}", String(steps.length))}
        </p>
        <div className="flex gap-1" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.id} className={cx("h-2 flex-1 rounded-full", i <= current ? "bg-brand" : "bg-line")} />
          ))}
        </div>
      </div>

      {steps.map((s, i) => (
        <section
          key={s.id}
          aria-labelledby={`step-${s.id}`}
          className={cx(
            "flex-col gap-4 md:flex md:rounded-2xl md:border md:border-line md:bg-surface md:p-6",
            i === current ? "flex" : "hidden",
          )}
        >
          <h2 id={`step-${s.id}`} className="text-xl font-bold text-ink">
            <span className="mr-2 hidden text-ink-muted md:inline">{i + 1}.</span>
            {s.title}
          </h2>
          {s.content}
        </section>
      ))}

      {/* Ноутбук: одна кнопка в конце */}
      <div className="hidden flex-col items-end gap-2 md:flex">
        {!allValid && <p className="text-base font-semibold text-danger">{t("ui.form.fixErrors")}</p>}
        <Button type="submit" disabled={!allValid} loading={loading} className="min-w-64">
          {submitLabel}
        </Button>
      </div>

      {/* Телефон: навигация по шагам внизу */}
      <BottomActionBar className="md:hidden">
        <div className="flex gap-2">
          {current > 0 && (
            <Button
              variant="secondary"
              onClick={() => setCurrent(current - 1)}
              icon={<IconChevronLeft />}
              aria-label={t("ui.action.back")}
              className="shrink-0 px-4"
            >
              <span className="sr-only">{t("ui.action.back")}</span>
            </Button>
          )}
          {isLast ? (
            <Button type="submit" fullWidth disabled={!allValid} loading={loading}>
              {submitLabel}
            </Button>
          ) : (
            <Button fullWidth disabled={!currentValid} onClick={() => setCurrent(current + 1)}>
              {t("ui.action.next")}
            </Button>
          )}
        </div>
      </BottomActionBar>
    </form>
  );
}
