"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import { IconBell, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

// Колокольчик со счётчиком непрочитанных. Счётчик обновляется через Realtime:
// новое уведомление (INSERT) или «прочитано» (UPDATE) — и число пересчитывается.
export function NotificationBell({
  employeeId,
  initialUnread,
  dark = false,
}: {
  employeeId: string;
  initialUnread: number;
  dark?: boolean;
}) {
  const t = useT();
  const [unread, setUnread] = useState(initialUnread);

  const recount = useCallback(async () => {
    const supabase = createClient();
    // Мастер по правилам чтения видит чужие уведомления, поэтому фильтр по себе обязателен.
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .is("read_at", null);
    if (typeof count === "number") setUnread(count);
  }, [employeeId]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`bell-${employeeId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `employee_id=eq.${employeeId}` },
          () => void recount(),
        )
        .subscribe();
    });
    // Вкладка снова на экране — сверяем число.
    const onVisible = () => {
      if (document.visibilityState === "visible") void recount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [employeeId, recount]);

  const label = unread > 0 ? t("shell.bellUnread").replace("{n}", String(unread)) : t("shell.bell");

  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className={cx(
        "relative flex size-11 shrink-0 items-center justify-center rounded-xl border",
        dark ? "border-white/30 text-white hover:bg-white/10" : "border-line bg-surface text-ink hover:bg-canvas",
      )}
    >
      <IconBell className="size-5" />
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-extrabold text-ink">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
