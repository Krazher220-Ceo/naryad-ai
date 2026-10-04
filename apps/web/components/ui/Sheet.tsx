"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/components/LocaleProvider";
import { IconX } from "./icons";

// Нижний лист для списка или справки (очередь отправки и т. п.). На ПК — окно по центру.
// Для подтверждения действия есть ConfirmSheet.
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label={t("ui.action.close")}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/60"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[85dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink focus:outline-none md:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("ui.action.close")}
            className="flex size-touch-sm shrink-0 items-center justify-center rounded-xl border border-line hover:bg-canvas"
          >
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
