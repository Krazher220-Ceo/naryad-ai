-- 0004_event_clock.sql — точное время событий журнала.
-- now() одинаков для всей транзакции, поэтому два события из одной функции
-- («исполнено» и «на проверку ИИ») получали одно время и теряли порядок.
-- clock_timestamp() даёт реальное время каждой записи.

alter table work_order_events alter column created_at set default clock_timestamp();
