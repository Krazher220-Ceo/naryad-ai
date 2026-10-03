import { signOut } from "@/lib/auth/actions";
import { t } from "@/lib/i18n";

interface AppHeaderProps {
  fullName: string;
  roleLabel: string;
}

export function AppHeader({ fullName, roleLabel }: AppHeaderProps) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="h-1 bg-accent" />
      <div className="mx-auto flex w-full max-w-sm items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-bold tracking-wider uppercase text-accent-ink">
            {t("app.name")}
          </span>
          <span className="truncate text-lg font-bold text-ink" title={fullName}>
            {fullName}
          </span>
          <span className="text-base font-medium text-ink-muted">
            {roleLabel}
          </span>
        </div>
        <form action={signOut} className="shrink-0">
          <button
            type="submit"
            className="flex min-h-touch-sm items-center justify-center rounded-xl border-2 border-ink bg-surface px-4 text-base font-semibold text-ink hover:bg-canvas active:bg-line"
          >
            {t("auth.signOut")}
          </button>
        </form>
      </div>
    </header>
  );
}
