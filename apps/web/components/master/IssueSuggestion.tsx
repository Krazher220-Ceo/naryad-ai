// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { Card, IconCheck, IconInfo, WorkerStatusDot, cx } from "@/components/ui";
import { type MessageKey } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";

export type IssueClassification = {
  faultCode: string | null;
  category: string | null;
  priority: "emergency" | "high" | "normal" | "planned" | null;
  specialty: string | null;
  confidence: number;
  source: "laya" | "llm";
};

export type IssueCandidate = {
  id: string;
  fullName: string;
  specialty: string | null;
  boardStatus: "free" | "busy" | "queue" | "off";
  queue: number;
  rating: number | null;
  reason: string;
};

type IssueSuggestionProps = {
  classification: IssueClassification;
  candidates: IssueCandidate[];
  selectedWorkerId?: string | null;
  onSelectCandidate: (candidateId: string) => void;
};

export function IssueSuggestion({
  classification,
  candidates,
  selectedWorkerId,
  onSelectCandidate,
}: IssueSuggestionProps) {
  const t = useT();
  const codeText = classification.faultCode ?? t("issueAi.noCode");
  const priorityText = classification.priority
    ? t(`orders.priority.${classification.priority}` as MessageKey)
    : t("issueAi.noPriority");
  const sourceText = t(`ai.source.${classification.source}` as MessageKey);
  const confidencePercent = String(Math.round(classification.confidence * 100));

  const details = t("issueAi.details")
    .replace("{code}", codeText)
    .replace("{priority}", priorityText)
    .replace("{source}", sourceText)
    .replace("{confidence}", confidencePercent);

  const topCandidates = candidates.slice(0, 3);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <IconInfo className="size-5 shrink-0 text-accent-ink" />
        <h3 className="text-lg font-bold text-ink">{t("issueAi.title")}</h3>
      </div>
      <p className="text-base leading-relaxed text-ink-muted">{details}</p>
      {topCandidates.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          {topCandidates.map((cand) => {
            const isSelected = selectedWorkerId === cand.id;
            return (
              <button
                key={cand.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectCandidate(cand.id)}
                className={cx(
                  "flex min-h-touch-sm flex-col gap-1 rounded-xl border-2 p-3 text-left transition-colors",
                  isSelected
                    ? "border-brand bg-brand/5 ring-1 ring-brand"
                    : "border-line-strong bg-surface hover:bg-canvas active:bg-line",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <WorkerStatusDot state={cand.boardStatus} />
                    <span className="truncate text-base font-bold text-ink">{cand.fullName}</span>
                  </div>
                  {isSelected && (
                    <span className="flex shrink-0 items-center gap-1 text-base font-semibold text-brand">
                      <IconCheck className="size-5 shrink-0" />
                      {t("issueAi.selected")}
                    </span>
                  )}
                </div>
                <p className="text-base text-ink-muted">{cand.reason}</p>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
