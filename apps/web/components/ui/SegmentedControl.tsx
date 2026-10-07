// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { cx } from "./cx";
import { IconCheck } from "./icons";

type Option<T extends string> = {
  value: T;
  label: string;
  // danger — выбранный вариант красный (например, «Аварийный»).
  tone?: "default" | "danger";
};

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
};

// Выбор одним нажатием вместо выпадающего списка. До 3 вариантов в ряд, 4 — сеткой 2×2 на телефоне.
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, className }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(
        "grid gap-2",
        options.length === 2 && "grid-cols-2",
        options.length === 3 && "grid-cols-3",
        options.length >= 4 && "grid-cols-2 sm:grid-cols-4",
        className,
      )}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex min-h-touch items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-base font-semibold",
              !selected && "border-line-strong bg-surface text-ink hover:bg-canvas",
              selected && o.tone === "danger" && "border-danger bg-danger text-white",
              selected && o.tone !== "danger" && "border-brand bg-brand text-white",
            )}
          >
            {selected && <IconCheck className="size-5 shrink-0" />}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
