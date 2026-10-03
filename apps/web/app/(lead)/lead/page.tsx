import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";

export default async function LeadPage() {
  const employee = await requireRole("lead");

  const cards = [
    { href: "/lead/shift", title: t("shiftReport.title"), hint: t("shiftReport.linkHint") },
    { href: "/lead/rating", title: t("rating.linkLead"), hint: t("rating.linkHint") },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader fullName={employee.fullName} roleLabel={t("roles.lead")} />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col p-4">
        <h1 className="text-xl font-bold text-slate-900">{t("home.lead")}</h1>

        <ul className="mt-4 flex flex-col gap-3">
          {cards.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="flex min-h-touch flex-col gap-1 rounded-2xl border-2 border-line-strong bg-surface p-4 hover:bg-canvas"
              >
                <span className="text-xl font-bold text-ink">{c.title}</span>
                <span className="text-base text-ink-muted">{c.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
