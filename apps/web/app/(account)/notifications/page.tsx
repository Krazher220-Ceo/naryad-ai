// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { redirect } from "next/navigation";
import { EmptyState, cx } from "@/components/ui";
import { getCurrentEmployee } from "@/lib/auth/session";
import { getLocale, getT } from "@/lib/i18n-server";
import type { MessageKey } from "@/lib/i18n";
import { markAllRead, openNotification } from "@/lib/notify/actions";
import { createClient } from "@/lib/supabase/server";
import { PendingButton } from "./PendingButton";

// Центр уведомлений: те же события, что уходят в Telegram (PLAN.md, раздел 8.1).
export default async function NotificationsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  // Мастер по правилам чтения видит все уведомления, поэтому фильтр по себе обязателен.
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, text, order_id, read_at, created_at")
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false })
    .limit(60);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  // Куда ведёт уведомление о наряде: у руководителя своей карточки наряда нет.
  const orderHref = (orderId: string | null) => {
    if (!orderId) return null;
    if (employee.role === "worker") return `/worker/orders/${orderId}`;
    if (employee.role === "master") return `/master/orders/${orderId}`;
    return null;
  };

  const time = (iso: string) =>
    new Date(iso).toLocaleString(locale === "kk" ? "kk-KZ" : "ru-RU", {
      timeZone: "Asia/Qostanay",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:max-w-3xl lg:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-3xl font-semibold text-ink">{t("inbox.title")}</h1>
          {unread > 0 && <span className="text-base text-ink-muted">{t("inbox.newCount").replace("{n}", String(unread))}</span>}
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <PendingButton className="min-h-touch-sm rounded-xl border-2 border-ink bg-surface px-4 text-base font-semibold text-ink hover:bg-canvas">
              {t("inbox.readAll")}
            </PendingButton>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState title={t("inbox.emptyTitle")} text={t("inbox.emptyText")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const href = orderHref(n.order_id);
            const isNew = !n.read_at;
            return (
              <li key={n.id}>
                <form action={openNotification.bind(null, n.id, href)}>
                  <PendingButton
                    className={cx(
                      "flex w-full flex-col gap-1.5 rounded-2xl border bg-surface p-4 text-left hover:bg-canvas",
                      isNew ? "border-2 border-brand" : "border-line",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase text-brand-hover">
                        {isNew && <span aria-hidden="true" className="size-2.5 rounded-full bg-accent" />}
                        {t(`inbox.kind.${n.kind}` as MessageKey)}
                        {isNew && <span className="sr-only">{t("inbox.unread")}</span>}
                      </span>
                      <span className="text-sm text-ink-muted">{time(n.created_at)}</span>
                    </span>
                    <span className="whitespace-pre-line text-base text-ink">{n.text}</span>
                    {href && <span className="text-base font-semibold text-brand underline-offset-4">{t("inbox.openOrder")} →</span>}
                  </PendingButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
