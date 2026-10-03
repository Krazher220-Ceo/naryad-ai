"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Обновление экрана без перезагрузки страницы (требование кейса: не дольше 5 секунд).
// Подписываемся на изменения нарядов в Supabase Realtime. Когда что-то изменилось,
// просим Next заново получить данные страницы с сервера (router.refresh).
// Realtime соблюдает правила доступа: исполнитель получает события только по своим нарядам.
//
// Достаточно один раз положить <RealtimeRefresh /> на страницу.

export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Несколько изменений подряд (наряд + журнал) склеиваем в одно обновление.
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    const channel = supabase
      .channel("orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, scheduleRefresh)
      .subscribe();

    // Телефон уснул и проснулся: сразу подтягиваем свежие данные.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
