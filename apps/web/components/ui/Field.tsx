// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useT } from "@/components/LocaleProvider";
import { cx } from "./cx";
import { IconChevronDown } from "./icons";

type FieldProps = {
  label: string;
  // id поля ввода. Если не задан, Field — группа (fieldset), например для SegmentedControl.
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
};

// Подпись, подсказка и ошибка вокруг любого поля.
export function Field({ label, htmlFor, hint, error, required, children }: FieldProps) {
  const t = useT();
  const caption = (
    <>
      {label}
      <span className="ml-2 text-base font-normal text-ink-muted">
        {required ? `(${t("ui.form.required")})` : ""}
      </span>
    </>
  );
  const extra = (
    <>
      {hint && !error && <p className="text-base text-ink-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-base font-semibold text-danger">
          {error}
        </p>
      )}
    </>
  );

  if (htmlFor) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={htmlFor} className="text-lg font-semibold text-ink">
          {caption}
        </label>
        {children}
        {extra}
      </div>
    );
  }
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-lg font-semibold text-ink">{caption}</legend>
      {children}
      {extra}
    </fieldset>
  );
}

const controlClass =
  "w-full rounded-xl border-2 bg-surface px-4 text-lg text-ink placeholder:text-ink-muted focus:border-focus focus:outline-none";

function borderClass(invalid?: boolean) {
  return invalid ? "border-danger" : "border-line-strong";
}

type InvalidProp = { invalid?: boolean };

export function TextInput({ invalid, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & InvalidProp) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cx(controlClass, "min-h-touch", borderClass(invalid), className)}
      {...rest}
    />
  );
}

export function TextArea({ invalid, className, rows = 4, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & InvalidProp) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cx(controlClass, "py-3 leading-relaxed", borderClass(invalid), className)}
      {...rest}
    />
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> &
  InvalidProp & {
    options: { value: string; label: string }[];
    placeholder?: string;
  };

// Обычный выпадающий список. Если вариантов 2–4, лучше SegmentedControl.
export function Select({ invalid, className, options, placeholder, ...rest }: SelectProps) {
  const t = useT();
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cx(controlClass, "min-h-touch appearance-none pr-12", borderClass(invalid), className)}
        {...rest}
      >
        <option value="">{placeholder ?? t("ui.form.selectPlaceholder")}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-4 top-1/2 size-6 -translate-y-1/2 text-ink" />
    </div>
  );
}
