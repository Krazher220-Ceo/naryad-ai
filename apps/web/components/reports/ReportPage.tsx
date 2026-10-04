import Link from "next/link";
import { cx } from "@/components/ui";
import { getT } from "@/lib/i18n-server";

// Общая оболочка страниц отчётов руководителя: шапка, «Назад», заголовок.
export function ReportPage({
  backHref,
  backLabel,
  title,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 pb-8 lg:max-w-6xl">
        <Link href={backHref} className="inline-flex min-h-touch-sm items-center text-base font-semibold text-ink underline">
          ← {backLabel}
        </Link>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {children}
      </main>
    </div>
  );
}

// Переключатель периода: ссылки, состояние в адресе.
export async function PeriodSwitch({
  basePath,
  days,
  options,
  extraQuery = "",
}: {
  basePath: string;
  days: number;
  options: readonly number[];
  extraQuery?: string;
}) {
  const t = await getT();
  return (
    <nav
      aria-label={t("rating.period")}
      className={cx("grid gap-2 lg:max-w-md", options.length === 3 ? "grid-cols-3" : "grid-cols-2")}
    >
      {options.map((p) => (
        <Link
          key={p}
          href={`${basePath}?days=${p}${extraQuery}`}
          aria-current={p === days ? "page" : undefined}
          className={cx(
            "flex min-h-touch items-center justify-center rounded-xl border-2 px-2 text-base font-semibold",
            p === days ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas",
          )}
        >
          {t(`rating.days${p as 7 | 30 | 90}`)}
        </Link>
      ))}
    </nav>
  );
}
