// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { RatingScreen, parseDays } from "@/components/reports/RatingScreen";
import { requireRole } from "@/lib/auth/session";

export default async function LeadRatingPage({ searchParams }: PageProps<"/lead/rating">) {
  await requireRole("lead");
  const { days } = await searchParams;
  return (
    <RatingScreen basePath="/lead" days={parseDays(days)} />
  );
}
