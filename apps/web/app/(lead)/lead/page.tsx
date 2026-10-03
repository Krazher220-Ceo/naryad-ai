import { requireRole } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { t } from "@/lib/i18n";

export default async function LeadPage() {
  const employee = await requireRole("lead");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">{t("home.lead")}</h1>
      <p className="text-lg">{employee.fullName}</p>
      <p>{t("roles.lead")}</p>
      <form action={signOut} className="mt-auto">
        <button type="submit" className="min-h-14 w-full rounded border text-lg">
          {t("auth.signOut")}
        </button>
      </form>
    </main>
  );
}
