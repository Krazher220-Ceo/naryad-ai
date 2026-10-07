// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { type MessageKey } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";
import { cx } from "./cx";
import type { OrderStatus } from "./types";

// Полные строки классов: Tailwind находит их в коде только целиком.
const statusClass: Record<OrderStatus, string> = {
  issued: "bg-st-issued-bg text-st-issued-fg",
  accepted: "bg-st-accepted-bg text-st-accepted-fg",
  queued: "bg-st-queued-bg text-st-queued-fg",
  rejected: "bg-st-rejected-bg text-st-rejected-fg",
  in_progress: "bg-st-in-progress-bg text-st-in-progress-fg",
  paused: "bg-st-paused-bg text-st-paused-fg",
  done: "bg-st-done-bg text-st-done-fg",
  ai_review: "bg-st-ai-review-bg text-st-ai-review-fg",
  rework: "bg-st-rework-bg text-st-rework-fg",
  closed: "bg-st-closed-bg text-st-closed-fg",
  cancelled: "bg-st-cancelled-bg text-st-cancelled-fg",
};

// Статус наряда: цвет и текст вместе, чтобы различал и дальтоник.
export function StatusBadge({ status }: { status: OrderStatus }) {
  const t = useT();
  return (
    <span
      className={cx(
        "inline-flex min-h-8 whitespace-nowrap items-center gap-1.5 rounded-lg border border-current/25 px-2.5 text-base font-semibold",
        statusClass[status],
      )}
    >
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {t(`orders.status.${status}` as MessageKey)}
    </span>
  );
}
