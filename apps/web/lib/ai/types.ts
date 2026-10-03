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
