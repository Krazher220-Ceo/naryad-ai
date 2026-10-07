// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { getT } from "@/lib/i18n-server";

const linkClass =
  "inline-flex min-h-touch-sm flex-1 items-center justify-center rounded-xl border-2 border-ink bg-surface px-4 text-base font-semibold text-ink hover:bg-canvas active:bg-line sm:flex-none";

// Две ссылки на выгрузку отчёта. Обычные <a>: файл скачивается, а не открывается как страница.
export async function ExportButtons({ report, params }: { report: string; params: Record<string, string | number> }) {
  const t = await getT();
  const href = (format: "xlsx" | "pdf") => {
    const query = new URLSearchParams({ format, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    return `/api/export/${report}?${query.toString()}`;
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-base font-semibold text-ink-muted">{t("export.title")}</span>
      <a href={href("xlsx")} download className={linkClass}>
        {t("export.excel")}
      </a>
      <a href={href("pdf")} download className={linkClass}>
        {t("export.pdf")}
      </a>
    </div>
  );
}
