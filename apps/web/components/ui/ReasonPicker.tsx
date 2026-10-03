"use client";

import { t } from "@/lib/i18n";
import { cx } from "./cx";
import { IconCheck } from "./icons";
import { TextArea } from "./Field";
import type { ReasonCode } from "@/lib/orders/transitions";

export const OTHER_REASON: ReasonCode = "other";

// code пустой, пока ничего не выбрано.
export type ReasonValue = { code: ReasonCode | ""; text: string };

type ReasonPickerProps = {
  // REJECT_REASONS или PAUSE_REASONS из lib/orders/transitions.ts. «Другое» там уже последнее.
  codes: readonly ReasonCode[];
  value: ReasonValue;
  onChange: (value: ReasonValue) => void;
  // Показать подсказку, что причина обязательна (после попытки отправить без неё).
  showError?: boolean;
};

// Причина готова, если выбран вариант, а для «Другое» ещё и написан текст.
export function isReasonValid(value: ReasonValue): boolean {
  if (!value.code) return false;
  if (value.code === OTHER_REASON) return value.text.trim().length > 0;
  return true;
}

// Причина отказа или паузы: крупные готовые варианты плюс «Другое» с текстом.
export function ReasonPicker({ codes, value, onChange, showError }: ReasonPickerProps) {

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={t("ui.reason.title")} className="flex flex-col gap-2">
        {codes.map((code) => {
          const selected = value.code === code;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ code, text: code === OTHER_REASON ? value.text : "" })}
              className={cx(
                "flex min-h-touch items-center gap-3 rounded-xl border-2 px-4 text-left text-lg font-semibold",
                selected ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas",
              )}
            >
              <span
                className={cx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-white" : "border-line-strong",
                )}
              >
                {selected && <IconCheck className="size-4" />}
              </span>
              {t(`orders.reasons.${code}`)}
            </button>
          );
        })}
      </div>
      {value.code === OTHER_REASON && (
        <TextArea
          rows={3}
          autoFocus
          aria-label={t("ui.reason.otherPlaceholder")}
          placeholder={t("ui.reason.otherPlaceholder")}
          value={value.text}
          invalid={showError && !isReasonValid(value)}
          onChange={(e) => onChange({ code: OTHER_REASON, text: e.target.value })}
        />
      )}
      {showError && !isReasonValid(value) && (
        <p role="alert" className="text-base font-semibold text-danger">
          {t("orders.reasonRequired")}
        </p>
      )}
    </div>
  );
}
