// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/LocaleProvider";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import {
  IconChart,
  IconChat,
  IconChevronLeft,
  IconClipboard,
  IconPlus,
  IconScan,
  IconUser,
  IconWarning,
  cx,
} from "@/components/ui";
import { SignOutButton } from "@/components/shell/SignOutButton";
import type { Role } from "@/lib/auth/roles";
import { ConnectionPill } from "./ConnectionPill";
import { LinkIcon } from "./LinkIcon";
import { NotificationBell } from "./NotificationBell";
import { NAV, backHref, hidesBottomNav, isActive, pageTitle, type NavIcon } from "./nav";

// Каркас экрана: одно дерево, две раскладки (PLAN.md, раздел 8.1).
// Телефон (< 1024 px): белая шапка сверху, три кнопки внизу.
// ПК (≥ 1024 px): тёмное меню слева, аккаунт, связь и язык внизу меню.

const ICONS: Record<NavIcon, (p: { className?: string }) => React.ReactNode> = {
  orders: IconClipboard,
  scan: IconScan,
  user: IconUser,
  chart: IconChart,
  plus: IconPlus,
  chat: IconChat,
  warning: IconWarning,
};

type ShellFrameProps = {
  role: Role;
  // null — оператор без входа: нет колокольчика, вместо «Выйти» — «Войти».
  employeeId: string | null;
  fullName: string;
  roleLabel: string;
  unread: number;
  children: React.ReactNode;
};

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ShellFrame({ role, employeeId, fullName, roleLabel, unread, children }: ShellFrameProps) {
  const t = useT();
  const pathname = usePathname();
  const back = backHref(role, pathname);
  const nav = NAV[role];
  const showBottomNav = !hidesBottomNav(pathname);
  // Если профиля нет среди трёх кнопок (у мастера), он открывается из шапки.
  const profileHref = role === "operator" ? "/operator/profile" : "/profile";
  const profileInNav = nav.phone.some((item) => item.href === profileHref);

  return (
    <div className="shell flex min-h-dvh flex-1 flex-col lg:flex-row">
      {/* ===== ПК: меню слева ===== */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-5 overflow-y-auto bg-ink px-4 py-5 text-white lg:flex">
        <Link href={nav.pc[0].href} className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-3">
          <span aria-hidden="true" className="km-logo h-8 bg-brand" />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-xl font-semibold text-brand">{t("app.name")}</span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-brand-hover">{t("shell.company")}</span>
          </span>
        </Link>

        <nav aria-label={t("shell.sections")} className="flex flex-col gap-0.5">
          {nav.pc.map((item) => {
            const active = isActive(item, pathname);
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px]",
                  active ? "bg-brand-hover font-bold text-white" : "font-semibold text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <LinkIcon icon={Icon} className="size-5 shrink-0" />
                <span className="flex-1">{t(item.label)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <section
          aria-label={t("shell.account")}
          className="flex flex-col gap-3.5 rounded-2xl border border-white/15 bg-white/5 p-3.5"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-hover text-[15px] font-extrabold">
              {initials(fullName)}
            </span>
            <Link href={profileHref} className="flex min-w-0 flex-1 flex-col leading-tight hover:underline">
              <b className="truncate text-[15px]" title={fullName}>{fullName}</b>
              <span className="text-[13px] text-white/70">{roleLabel}</span>
            </Link>
            {employeeId && <NotificationBell employeeId={employeeId} initialUnread={unread} dark />}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-wider uppercase text-white/60">{t("shell.connection")}</span>
            <ConnectionPill wide />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-wider uppercase text-white/60">{t("shell.language")}</span>
            <LanguageSwitch full dark />
          </div>
          {employeeId ? (
            <SignOutButton className="min-h-11 w-full rounded-xl border border-white/35 text-[15px] font-bold hover:bg-white/10">
              {t("shell.signOut")}
            </SignOutButton>
          ) : (
            <Link
              href="/login"
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/35 text-[15px] font-bold hover:bg-white/10"
            >
              {t("shell.signIn")}
            </Link>
          )}
        </section>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ===== Телефон: шапка ===== */}
        <header className="sticky top-0 z-30 border-b border-line bg-surface pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="h-1 bg-accent" />
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {back ? (
                <Link
                  href={back}
                  aria-label={t("ui.action.back")}
                  className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-canvas active:bg-line"
                >
                  <IconChevronLeft className="size-7" />
                </Link>
              ) : (
                <span aria-hidden="true" className="km-logo h-7 shrink-0 bg-brand" />
              )}
              <span className="truncate font-display text-[22px] font-semibold text-ink">{t(pageTitle(role, pathname))}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ConnectionPill />
              {employeeId && <NotificationBell employeeId={employeeId} initialUnread={unread} />}
              {!profileInNav && (
                <Link
                  href={profileHref}
                  aria-label={t("shell.profile")}
                  className="flex size-11 items-center justify-center rounded-xl border border-line text-ink hover:bg-canvas"
                >
                  <LinkIcon icon={IconUser} className="size-5" />
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className={cx("flex flex-1 flex-col", showBottomNav && "pb-24 lg:pb-0")}>{children}</div>

        {/* ===== Телефон: три кнопки внизу ===== */}
        {showBottomNav && (
          <nav
            aria-label={t("shell.sections")}
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 items-end border-t border-line bg-surface px-3 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden"
          >
            {nav.phone.map((item, index) => {
              const active = isActive(item, pathname);
              const Icon = ICONS[item.icon];
              if (index === 1) {
                // Средняя кнопка — главное действие роли, крупная и приподнята.
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className="flex flex-col items-center gap-1 text-[13px] font-bold text-ink"
                  >
                    <span className="-mt-7 flex size-16 items-center justify-center rounded-[20px] border-4 border-canvas bg-brand text-white shadow-lg shadow-brand/35">
                      <LinkIcon icon={Icon} className="size-7" />
                    </span>
                    {t(item.label)}
                  </Link>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex min-h-touch flex-col items-center justify-center gap-1 text-[13px]",
                    active ? "font-bold text-brand" : "font-semibold text-ink-muted",
                  )}
                >
                  <LinkIcon icon={Icon} className="size-[26px]" />
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
