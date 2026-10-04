import { LanguageSwitch } from "@/components/LanguageSwitch";
import { signOut } from "@/lib/auth/actions";
import { getT } from "@/lib/i18n-server";

interface AppHeaderProps {
  fullName: string;
  roleLabel: string;
}

export async function AppHeader({ fullName, roleLabel }: AppHeaderProps) {
  const t = await getT();
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
        <div className="flex shrink-0 flex-col items-end gap-2">
          <LanguageSwitch />
          <form action={signOut}>
          <button
            type="submit"
            className="flex min-h-touch-sm items-center justify-center rounded-xl border-2 border-ink bg-surface px-4 text-base font-semibold text-ink hover:bg-canvas active:bg-line"
          >
            {t("auth.signOut")}
          </button>
          </form>
        </div>
      </div>
    </header>
  );
}
