import { requireRole } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";

export default async function MasterPage() {
  const employee = await requireRole("master");

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader fullName={employee.fullName} roleLabel={t("roles.master")} />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col p-4 pb-28">
        <h1 className="text-xl font-bold text-slate-900">{t("home.master")}</h1>

        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            {t("emptyState.master")}
          </p>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-slate-50/95 p-4 backdrop-blur-sm">
        <div className="mx-auto max-w-sm">
          <button
            type="button"
            disabled
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-200 text-base font-semibold text-slate-500 shadow-sm cursor-not-allowed"
          >
            <span>{t("master.issueOrder")}</span>
            <span className="rounded bg-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600">
              {t("common.soon")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
