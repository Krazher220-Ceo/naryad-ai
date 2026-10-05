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

    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    // Сначала передаём Realtime токен вошедшего пользователя. Иначе подписка уходит
    // от имени анонима, и правила доступа не присылают ни одного события по нарядам.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel("orders-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, scheduleRefresh)
        // Новые заявки операторов: мастер видит их сразу (правила доступа пропускают только мастеру и руководителю).
        .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, scheduleRefresh)
        .subscribe();
    });

    // Телефон уснул и проснулся: подтягиваем свежие данные. Сначала ждём, пока клиент
    // сам обновит токен: иначе клиент и proxy.ts обновляют его одновременно по одному
    // refresh-токену, и вход сбрасывается.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.auth.getSession().finally(() => router.refresh());
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
