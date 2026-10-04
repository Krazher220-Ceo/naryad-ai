"use client";

import { Card, IconAlert, IconCheck, IconInfo, IconX, InlineNotice, cx } from "@/components/ui";
import type { MessageKey, Translate } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";
import type { OrderDetails } from "@/lib/orders/queries";

export type Review = NonNullable<OrderDetails["review"]>;
type Verdict = Review["verdict"];

// Подстановка значений в текст словаря: "{score} из 5" -> "3 из 5".
function fill(t: Translate, key: MessageKey, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [k, v]) => text.split(`{${k}}`).join(String(v)), t(key));
}

const verdictStyle: Record<Verdict, string> = {
  accept: "border-success bg-success-soft",
  accept_with_note: "border-accent-ink bg-warning-soft",
  rework: "border-danger bg-danger-soft",
  needs_master: "border-info bg-info-soft",
};

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  const cls = "size-8 shrink-0";
  if (verdict === "accept") return <IconCheck className={cx(cls, "text-success")} />;
  if (verdict === "accept_with_note") return <IconAlert className={cx(cls, "text-accent-ink")} />;
  if (verdict === "rework") return <IconX className={cx(cls, "text-danger")} />;
  return <IconInfo className={cx(cls, "text-info")} />;
}

function Title({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-bold text-ink">{children}</h3>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-ink">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const ruleLabel = { ok: "review.ruleOk", warn: "review.ruleWarn", fail: "review.ruleFail" } as const;

function RuleIcon({ status }: { status: "ok" | "warn" | "fail" }) {
  const cls = "mt-0.5 size-5 shrink-0";
  if (status === "ok") return <IconCheck className={cx(cls, "text-success")} />;
  if (status === "warn") return <IconAlert className={cx(cls, "text-accent-ink")} />;
  return <IconX className={cx(cls, "text-danger")} />;
}

function formatPercent(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100);
}

export function ReviewReport({ review, mode }: { review: Review; mode: "worker" | "master" }) {
  const t = useT();
  const { checks } = review;
  const finalScore = review.master_score ?? review.score;
  const percent = formatPercent(review.confidence);
  // Строка про время есть только если сработала проверка норматива.
  const timeCheck = checks.rules.find((r) => r.id.startsWith("time_"));

  return (
    <section className="flex flex-col gap-4">
      <div className={cx("flex flex-col gap-2 rounded-2xl border-l-8 p-4", verdictStyle[review.verdict])}>
        <div className="flex items-center gap-3">
          <VerdictIcon verdict={review.verdict} />
          <span className="min-w-0 flex-1 text-xl font-bold text-ink first-letter:uppercase">
            {t(`ai.verdict.${review.verdict}`)}
          </span>
          <span className="shrink-0 text-3xl font-bold text-ink">
            {finalScore === null ? t("review.noScore") : fill(t, "review.scoreOf", { score: finalScore })}
          </span>
        </div>
        {mode === "master" && (
          <span className="text-base text-ink-muted">
            {t("review.sourceLabel")}: {t(`ai.source.${review.source}`)}
            {percent !== null && ` · ${fill(t, "review.confidence", { percent })}`}
          </span>
        )}
      </div>

      {review.master_score !== null && (
        <InlineNotice tone="info">
          <span>{fill(t, "review.masterScore", { score: review.master_score })}</span>
          {review.master_reason && <span className="font-normal">{fill(t, "review.masterScoreReason", { reason: review.master_reason })}</span>}
          {mode === "master" && review.score !== null && (
            <span className="font-normal">{fill(t, "review.aiScore", { score: review.score })}</span>
          )}
        </InlineNotice>
      )}

      {mode === "master" && checks.errors.length > 0 && (
        <InlineNotice tone="warning">{t("review.modelUnavailable")}</InlineNotice>
      )}

      {mode === "worker" ? (
        <>
          {timeCheck && (
            <Card className="flex flex-col gap-1">
              <Title>{t("review.timeTitle")}</Title>
              <p className="text-base text-ink">{timeCheck.message}</p>
            </Card>
          )}
          <Card className="flex flex-col gap-2">
            <Title>{t("review.good")}</Title>
            {checks.text.good.length > 0 ? <BulletList items={checks.text.good} /> : <p className="text-base text-ink-muted">{t("review.nothing")}</p>}
          </Card>
          <Card className="flex flex-col gap-2">
            <Title>{t("review.improve")}</Title>
            {checks.text.improve.length > 0 ? <BulletList items={checks.text.improve} /> : <p className="text-base text-ink-muted">{t("review.nothing")}</p>}
          </Card>
        </>
      ) : (
        <>
          {(checks.text.summary || review.explanation) && (
            <Card className="flex flex-col gap-2">
              <Title>{t("review.summary")}</Title>
              <p className="text-base text-ink">{checks.text.summary || review.explanation}</p>
            </Card>
          )}

          {checks.rules.length > 0 && (
            <Card className="flex flex-col gap-2">
              <Title>{t("review.rulesTitle")}</Title>
              <ul className="flex flex-col gap-2">
                {checks.rules.map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <RuleIcon status={r.status} />
                    <span className="min-w-0 text-base text-ink">
                      <span className="sr-only">{t(ruleLabel[r.status])}: </span>
                      {r.message}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {checks.work_match && (
            <Card className="flex flex-col gap-1">
              <Title>{t("review.workMatchTitle")}</Title>
              <p className="text-base font-semibold text-ink">
                {checks.work_match.matches ? t("review.workMatchYes") : t("review.workMatchNo")}
                {` · ${fill(t, "review.confidence", { percent: Math.round(checks.work_match.confidence * 100) })}`}
              </p>
              <p className="text-base text-ink">{checks.work_match.explanation}</p>
            </Card>
          )}

          {checks.photo && (
            <Card className="flex flex-col gap-3">
              <Title>{t("review.photoTitle")}</Title>
              <div className="flex flex-col gap-2">
                <h4 className="text-base font-bold text-ink">{t("review.seen")}</h4>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-ink">
                  {checks.photo.same_equipment.value !== null && (
                    <li>{checks.photo.same_equipment.value ? t("review.sameEquipmentYes") : t("review.sameEquipmentNo")}</li>
                  )}
                  {checks.photo.visible_problem_before && (
                    <li>{fill(t, "review.problemBefore", { text: checks.photo.visible_problem_before })}</li>
                  )}
                  {checks.photo.visible_problem_after && (
                    <li>{fill(t, "review.problemAfter", { text: checks.photo.visible_problem_after })}</li>
                  )}
                  {checks.photo.repair_visible !== null && (
                    <li>{checks.photo.repair_visible ? t("review.repairVisible") : t("review.repairNotVisible")}</li>
                  )}
                </ul>
                {checks.photo.quality_findings.length > 0 && (
                  <>
                    <h4 className="text-base font-bold text-ink">{t("review.findings")}</h4>
                    <BulletList items={checks.photo.quality_findings} />
                  </>
                )}
              </div>
              {checks.photo.cannot_verify.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-line-strong p-3">
                  <h4 className="text-base font-bold text-ink">{t("review.cannotVerify")}</h4>
                  <BulletList items={checks.photo.cannot_verify} />
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </section>
  );
}
