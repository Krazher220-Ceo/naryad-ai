// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useLinkStatus } from "next/link";
import { IconSpinner } from "@/components/ui";

// Значок внутри ссылки: пока сервер готовит экран, вместо значка крутится колесо.
// Так видно, что нажатие сработало, даже при медленной связи.
export function LinkIcon({
  icon: Icon,
  className,
}: {
  icon: (p: { className?: string }) => React.ReactNode;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return pending ? <IconSpinner className={className} /> : <Icon className={className} />;
}
