// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useT } from "@/components/LocaleProvider";
import { IconMinus, IconPlus } from "./icons";

type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  label?: string;
};

// Количество крупными кнопками − и + (56 px, можно в перчатках). Число можно и ввести.
export function NumberStepper({ value, onChange, min = 0, max = 9999, step = 1, id, label }: NumberStepperProps) {
  const t = useT();
  // Округление убирает хвосты вида 0.30000000000000004.
  const clamp = (n: number) => Math.round(Math.min(max, Math.max(min, n)) * 1000) / 1000;

  const buttonClass =
    "flex size-touch shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-surface text-ink active:bg-line disabled:border-line disabled:text-line-strong";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={`${t("ui.form.decrease")}${label ? `: ${label}` : ""}`}
      >
        <IconMinus className="size-7" />
      </button>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={String(value)}
        onChange={(e) => {
          const n = Number(e.target.value.replace(",", "."));
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        className="min-h-touch w-20 min-w-0 flex-1 rounded-xl border-2 border-line-strong bg-surface text-center text-2xl font-bold text-ink focus:border-focus focus:outline-none"
      />
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label={`${t("ui.form.increase")}${label ? `: ${label}` : ""}`}
      >
        <IconPlus className="size-7" />
      </button>
    </div>
  );
}
