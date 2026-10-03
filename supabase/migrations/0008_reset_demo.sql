-- 0008_reset_demo.sql — сброс демонстрационных данных.
-- Нужен генератору истории (scripts/seed) и кнопке «Сбросить демо» (M4).
-- Удаляет наряды и всё, что к ним относится. Справочники и учётные записи не трогает.
-- TRUNCATE не вызывает построчные триггеры, поэтому запрет на удаление журнала тут не мешает:
-- журнал удаляется только целиком вместе с нарядами, отдельные записи по-прежнему менять нельзя.

create function reset_demo_orders() returns void
language plpgsql security definer set search_path = public as $$
begin
  truncate notifications, ai_reviews, material_usages, photos, requests, work_order_events, work_orders
    restart identity;
end;
$$;

-- Только служебный ключ (сервер, скрипты). Пользователям недоступно.
revoke execute on function reset_demo_orders() from public, anon, authenticated;
grant execute on function reset_demo_orders() to service_role;
