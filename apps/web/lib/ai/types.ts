// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import type { RuleCheck } from "./rules";
import type { PhotoCheck, ReviewText, WorkMatch } from "./schemas";

// Что лежит в ai_reviews.checks (jsonb). Пишет lib/ai/review.ts, читают экраны отчёта.
export type ReviewChecks = {
  rules: RuleCheck[];
  work_match: WorkMatch | null;
  photo: PhotoCheck | null;
  text: ReviewText;
  provider: "cloud" | "local";
  errors: string[];
};
