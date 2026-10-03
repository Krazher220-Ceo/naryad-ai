import { signOut } from "@/lib/auth/actions";
import { t } from "@/lib/i18n";

interface AppHeaderProps {
  fullName: string;
  roleLabel: string;
}

export function AppHeader({ fullName, roleLabel }: AppHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="h-1 bg-amber-500" />
      <div className="mx-auto flex w-full max-w-sm items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-bold tracking-wider uppercase text-amber-600">
            {t("app.name")}
          </span>
          <span className="truncate text-base font-bold text-slate-900" title={fullName}>
            {fullName}
          </span>
          <span className="text-xs font-medium text-slate-600">
            {roleLabel}
          </span>
        </div>
        <form action={signOut} className="shrink-0">
          <button
            type="submit"
            className="flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100"
          >
            {t("auth.signOut")}
          </button>
        </form>
      </div>
    </header>
  );
}
