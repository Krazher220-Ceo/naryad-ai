import { t, type MessageKey } from "@/lib/i18n";

// Подпись события в истории. События проверки ИИ лежат в разделе review, остальные — в orders.event.
export function eventLabel(action: string): string {
  if (action === "master_score") return t("review.event.masterScore");
  if (action === "ai_verdict") return t("review.event.aiVerdict");
  return t(`orders.event.${action}` as MessageKey);
}
