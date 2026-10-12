// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { Skeleton } from "@/components/ui";
import { getT } from "@/lib/i18n-server";

// Экран загрузки внутри каркаса (loading.tsx в каждом разделе). Next.js показывает его сразу после
// нажатия, пока сервер готовит страницу, поэтому кнопка откликается мгновенно, а не через секунду.
export async function PageLoading() {
  const t = await getT();
  return (
    <main role="status" aria-live="polite" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4 lg:py-8">
      <span className="sr-only">{t("ui.loading")}</span>
      <Skeleton className="h-9 w-2/3 max-w-sm" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-5/6" />
    </main>
  );
}
