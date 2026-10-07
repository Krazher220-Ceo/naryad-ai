// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useEffect } from "react";
import { useT } from "@/components/LocaleProvider";
import { cx } from "./cx";
import { IconAlert, IconCheck, IconInfo, IconWifiOff, IconX } from "./icons";

export type NoticeTone = "info" | "success" | "warning" | "danger" | "offline";

const toneClass: Record<NoticeTone, string> = {
  info: "border-info bg-info-soft",
  success: "border-success bg-success-soft",
  warning: "border-accent-ink bg-warning-soft",
  danger: "border-danger bg-danger-soft",
  offline: "border-ink bg-line",
};

function ToneIcon({ tone }: { tone: NoticeTone }) {
  const cls = "size-6 shrink-0";
  if (tone === "success") return <IconCheck className={cx(cls, "text-success")} />;
  if (tone === "danger") return <IconAlert className={cx(cls, "text-danger")} />;
  if (tone === "warning") return <IconAlert className={cx(cls, "text-accent-ink")} />;
  if (tone === "offline") return <IconWifiOff className={cx(cls, "text-ink")} />;
  return <IconInfo className={cx(cls, "text-info")} />;
}

// Сообщение внутри страницы: «Нет сети, отправим позже», «Сохранено».
export function InlineNotice({
  tone = "info",
  children,
  action,
}: {
  tone?: NoticeTone;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("flex items-start gap-3 rounded-xl border-l-8 p-4", toneClass[tone])}
    >
      <ToneIcon tone={tone} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-base font-semibold text-ink">
        {children}
        {action}
      </div>
    </div>
  );
}

// Всплывающее сообщение сверху. Само закрывается через duration мс.
export function Toast({
  open,
  tone = "success",
  message,
  onClose,
  duration = 4000,
}: {
  open: boolean;
  tone?: NoticeTone;
  message: string;
  onClose: () => void;
  duration?: number;
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div
        role="status"
        className={cx("mx-auto flex max-w-xl items-center gap-3 rounded-xl border-2 py-1 pl-4 pr-1 shadow-lg", toneClass[tone])}
      >
        <ToneIcon tone={tone} />
        <p className="flex-1 text-lg font-semibold text-ink">{message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("ui.action.close")}
          className="flex size-touch-sm shrink-0 items-center justify-center rounded-lg text-ink active:bg-ink/10"
        >
          <IconX />
        </button>
      </div>
    </div>
  );
}
