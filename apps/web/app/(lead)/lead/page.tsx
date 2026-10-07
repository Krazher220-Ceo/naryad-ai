// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import Link from "next/link";
import { Suspense } from "react";
import { AnomalyList } from "@/components/reports/AnomalyList";
import { ForecastBlock } from "@/components/reports/ForecastBlock";
import { PERIODS, fill, parseDaysIn } from "@/components/reports/format";
import { PeriodSwitch } from "@/components/reports/ReportPage";
import { Card, EmptyState, Skeleton, cx, formatMinutes } from "@/components/ui";
import { SnapshotBar } from "@/components/reports/SnapshotBar";
import { cachedDashboard } from "@/lib/analytics/cached";
import { getLeadSummary } from "@/lib/orders/queries";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";

const NAV = [
  { href: "/lead/rating", label: "rating.linkShort" },
  { href: "/lead/shift", label: "shiftReport.title" },
  { href: "/lead/anomalies", label: "anomalies.title" },
  { href: "/lead/materials", label: "materialsReport.title" },
  { href: "/lead/downtime", label: "downtimeReport.title" },
] as const;

function Tile({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={cx("flex flex-col gap-1 rounded-2xl border-2 p-4", alert ? "border-danger bg-danger-soft" : "border-line bg-surface")}>
      <span className={cx("text-3xl font-bold", alert ? "text-danger" : "text-ink")}>{value}</span>
      <span className="text-base font-semibold text-ink">{label}</span>
    </div>
  );
}

export default async function LeadPage({ searchParams }: PageProps<"/lead">) {
  const t = await getT();
  await requireRole("lead");
  const { days: daysParam } = await searchParams;
  const days = parseDaysIn(daysParam, PERIODS, 30);
  const [{ data: cached, computedAt }, now] = await Promise.all([cachedDashboard(days), getLeadSummary()]);
  // Текущие счётчики всегда живые; из снимка берётся только тяжёлая аналитика.
  const d = { ...cached, inWork: now.inWork, waiting: now.waiting, overdue: now.overdue };

  const minutes = (value: number | null) => (value === null ? t("dashboard.noValue") : formatMinutes(t, value));
  const maxHours = Math.max(0.1, ...d.topEquipment.map((e) => e.hours));

  return (
    <div className="flex flex-1 flex-col bg-canvas">

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-4 pb-8 lg:max-w-6xl">
        <h1 className="text-2xl font-bold text-ink">{t("home.lead")}</h1>

        {/* Сводка на сейчас: на телефоне руководитель видит её первой, на ПК — над показателями */}
        <section aria-label={t("leadNow.title")} className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-ink">{t("leadNow.title")}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t("leadNow.overdue")} value={String(now.overdue)} alert={now.overdue > 0} />
            <Tile label={t("leadNow.emergency")} value={String(now.emergency)} alert={now.emergency > 0} />
            <Tile label={t("leadNow.inWork")} value={String(now.inWork)} />
            <Tile label={t("leadNow.downtime")} value={fill(t("dashboard.downtimeValue"), { h: Math.round(d.downtimeHours) })} />
          </div>
          {now.escalations.length === 0 ? (
            <p className="text-base text-ink-muted">{t("leadNow.noEscalations")}</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {now.escalations.map((o) => (
                <Card key={o.id} tone="emergency" className="flex flex-col gap-1.5">
                  <b className="text-base text-ink">{t("leadNow.escalation").replace("{time}", formatMinutes(t, o.lateMin))}</b>
                  <span className="text-base text-ink">{o.description}</span>
                  <span className="text-sm text-ink-muted">
                    {t("leadNow.escalationItem")
                      .replace("{number}", String(o.number))
                      .replace("{equipment}", o.equipment?.name ?? "—")
                      .replace("{worker}", o.assignee?.full_name ?? "—")
                      .replace("{master}", o.master?.full_name ?? "—")}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* На ПК отчёты в меню слева, на телефоне — кнопками здесь */}
        <nav aria-label={t("dashboard.navTitle")} className="grid grid-cols-2 gap-2 lg:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex min-h-touch items-center justify-center rounded-xl border-2 border-line-strong bg-surface px-2 text-center text-base font-semibold text-ink hover:bg-canvas"
            >
              {t(n.label)}
            </Link>
          ))}
        </nav>

        <PeriodSwitch basePath="/lead" days={days} options={PERIODS} />
        <SnapshotBar kind="dashboard" scope={String(days)} computedAt={computedAt} />

        <section aria-label={t("dashboard.kpiTitle")} className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Tile label={t("dashboard.inWork")} value={String(d.inWork)} />
            <Tile label={t("dashboard.waiting")} value={String(d.waiting)} />
            <Tile label={t("dashboard.overdue")} value={String(d.overdue)} alert={d.overdue > 0} />
            <Tile label={t("dashboard.avgReaction")} value={minutes(d.avgReactionMin)} />
            <Tile label={t("dashboard.avgExecution")} value={minutes(d.avgExecutionMin)} />
            <Tile label={t("dashboard.downtime")} value={fill(t("dashboard.downtimeValue"), { h: Math.round(d.downtimeHours) })} />
          </div>
          <p className="text-base text-ink-muted">{fill(t("dashboard.ordersInPeriod"), { n: d.ordersInPeriod })}</p>
        </section>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink">{t("dashboard.topEquipmentTitle")}</h2>
            {d.topEquipment.length === 0 ? (
              <EmptyState title={t("dashboard.noDataTitle")} text={t("dashboard.noDataText")} />
            ) : (
              <Card className="flex flex-col gap-4">
                {d.topEquipment.map((e) => (
                  <div key={e.name} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-bold text-ink">{e.name}</span>
                      <span className="shrink-0 text-base text-ink">{fill(t("dashboard.topEquipmentItem"), { h: Math.round(e.hours), n: e.unplanned })}</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-line" aria-hidden="true">
                      <div className="h-3 rounded-full bg-ink" style={{ width: `${Math.max(2, Math.round((e.hours / maxHours) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink">{t("dashboard.bestWorkersTitle")}</h2>
            {d.bestWorkers.length === 0 ? (
              <EmptyState title={t("dashboard.noDataTitle")} text={t("dashboard.noDataText")} />
            ) : (
              <Card>
                <ol className="flex flex-col gap-3">
                  {d.bestWorkers.map((w, i) => (
                    <li key={w.name} className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold text-white">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{w.name}</span>
                      <span className="shrink-0 text-base text-ink">{fill(t("dashboard.points"), { n: Math.round(w.total) })}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </section>
        </div>

        <Suspense
          fallback={
            <div role="status" className="flex flex-col gap-3">
              <p className="text-base font-semibold text-ink">{t("forecast.loading")}</p>
              <Skeleton className="h-32" />
            </div>
          }
        >
          <ForecastBlock />
        </Suspense>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">{t("dashboard.anomaliesTitle")}</h2>
            <p className="text-base text-ink-muted">{t("dashboard.anomaliesHint")}</p>
          </div>
          <Suspense
            fallback={
              <div role="status" className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
                <p className="text-base font-semibold text-ink lg:col-span-2">{t("anomalies.loading")}</p>
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
              </div>
            }
          >
            <AnomalyList days={90} limit={3} allHref="/lead/anomalies" />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
