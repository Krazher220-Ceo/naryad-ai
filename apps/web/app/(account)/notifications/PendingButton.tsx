// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useFormStatus } from "react-dom";
import { IconSpinner, cx } from "@/components/ui";

// Кнопка формы, которая сразу показывает, что нажатие принято: колесо и бледнеет до ответа сервера.
export function PendingButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cx("relative", className, pending && "opacity-60")}>
      {children}
      {pending && <IconSpinner className="absolute right-3 bottom-3 size-6 text-brand" />}
    </button>
  );
}
