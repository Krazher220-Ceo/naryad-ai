import { requireRole } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";

export default async function LeadPage() {
  const employee = await requireRole("lead");

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader fullName={employee.fullName} roleLabel={t("roles.lead")} />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col p-4">
        <h1 className="text-xl font-bold text-slate-900">{t("home.lead")}</h1>

        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            {t("emptyState.lead")}
          </p>
        </div>
      </main>
    </div>
  );
}
