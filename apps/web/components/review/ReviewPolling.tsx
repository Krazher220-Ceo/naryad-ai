// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { InlineNotice, Skeleton } from "@/components/ui";
import { useT } from "@/components/LocaleProvider";

// Проверка ИИ появляется через несколько секунд после «Исполнено».
// Пока её нет, раз в 5 секунд просим страницу обновиться. Когда проверка пришла,
// сервер перестаёт рисовать этот компонент и опрос останавливается.
export function ReviewWaiting() {
  const t = useT();
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <section className="flex flex-col gap-3" aria-busy="true">
      <InlineNotice tone="info">
        <span>{t("review.waitingTitle")}</span>
        <span className="font-normal">{t("review.waitingText")}</span>
      </InlineNotice>
      <Skeleton className="h-20" />
      <Skeleton className="h-28" />
    </section>
  );
}
