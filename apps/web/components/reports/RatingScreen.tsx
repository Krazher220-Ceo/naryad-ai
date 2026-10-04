import Link from "next/link";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { RatingFormula, RatingTable } from "@/components/reports/RatingTable";
import { EmptyState, cx } from "@/components/ui";
import { getRating } from "@/lib/analytics/rating";
import { getT } from "@/lib/i18n-server";

const PERIODS = [7, 30, 90] as const;
type Days = (typeof PERIODS)[number];

export function parseDays(value: string | string[] | undefined): Days {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return PERIODS.find((p) => p === n) ?? 30;
}

// Одна страница рейтинга для мастера и руководителя: отличаются только базовый путь и подпись роли.
export async function RatingScreen({
  basePath,
  days,
}: {
  basePath: "/master" | "/lead";
  days: Days;
}) {
  const t = await getT();
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 3600_000);
  const rows = await getRating(from, to);

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 pb-8 lg:max-w-6xl">
        <Link href={basePath} className="inline-flex min-h-touch-sm items-center text-base font-semibold text-ink underline">
          ← {t("rating.back")}
        </Link>
        <h1 className="text-2xl font-bold text-ink">{t("rating.title")}</h1>

        <nav aria-label={t("rating.period")} className="grid grid-cols-3 gap-2 lg:max-w-md">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`${basePath}/rating?days=${p}`}
              aria-current={p === days ? "page" : undefined}
              className={cx(
                "flex min-h-touch items-center justify-center rounded-xl border-2 px-2 text-base font-semibold",
                p === days ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas",
              )}
            >
              {t(`rating.days${p}`)}
            </Link>
          ))}
        </nav>

        <ExportButtons report="rating" params={{ days }} />
        <RatingFormula />
        {rows.length === 0 ? (
          <EmptyState title={t("rating.emptyTitle")} text={t("rating.emptyText")} />
        ) : (
          <RatingTable rows={rows} />
        )}
      </main>
    </div>
  );
}
