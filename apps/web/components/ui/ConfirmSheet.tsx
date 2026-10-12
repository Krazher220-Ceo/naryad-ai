// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button } from "./Button";
import { useSheetDismiss } from "./useSheetDismiss";

type ConfirmSheetProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  // danger — для отказа и отмены.
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  loading?: boolean;
  // Дополнительное содержимое, например ReasonPicker.
  children?: React.ReactNode;
};

// Нижний лист подтверждения вместо window.confirm. На ноутбуке — окно по центру.
// «Отмена» стоит отдельно от опасной кнопки, чтобы не нажать её случайно.
export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  onConfirm,
  onCancel,
  confirmDisabled,
  loading,
  children,
}: ConfirmSheetProps) {
  const t = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const { dragProps, sheetStyle, dismiss } = useSheetDismiss(open, onCancel);

  // onCancel приходит новой функцией при каждой отрисовке. Держим её в ref, чтобы эффект ниже
  // срабатывал только при открытии: иначе каждая введённая буква уводила фокус из поля причины.
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  // Escape закрывает лист, фокус переносится внутрь — один раз при открытии.
  useEffect(() => {
    if (!open) return;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label={t("ui.action.cancel")}
        tabIndex={-1}
        onClick={dismiss}
        className="absolute inset-0 bg-ink/60"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-sheet-title"
        tabIndex={-1}
        style={sheetStyle}
        className="relative flex max-h-[90dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] focus:outline-none md:rounded-3xl"
      >
        <div
          {...dragProps}
          aria-hidden="true"
          className="-mx-5 -mt-5 flex h-8 shrink-0 cursor-grab touch-none items-center justify-center md:hidden"
        >
          <span className="h-1.5 w-12 rounded-full bg-line-strong" />
        </div>
        <h2 id="confirm-sheet-title" className="text-xl font-bold text-ink">
          {title}
        </h2>
        {description && <p className="text-base text-ink-muted">{description}</p>}
        {children}
        <div className="mt-2 flex flex-col gap-3">
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            fullWidth
            onClick={onConfirm}
            disabled={confirmDisabled}
            loading={loading}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" fullWidth onClick={dismiss}>
            {t("ui.action.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
