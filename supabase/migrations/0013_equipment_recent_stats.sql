-- 0013_equipment_recent_stats.sql — сводка по машине за 30 дней для экрана «Отсканировал машину» (M6).
-- Исполнитель по правилам доступа видит только свои наряды, поэтому общие цифры по машине
-- считает функция. Имён в ответе нет, только числа.
-- Простой считается так же, как в отчёте (lib/analytics/history.ts): внеплановый наряд
-- от выдачи до «Исполнено», отменённые не учитываются.

create function equipment_recent_stats(p_equipment_id uuid)
returns table (
  breakdowns_30d  integer,  -- внеплановых нарядов за 30 дней
  downtime_hours  numeric,  -- простой за 30 дней, часы
  open_orders     integer   -- открытых нарядов сейчас (до «Исполнено»)
)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where o.type = 'unplanned' and o.status <> 'cancelled' and o.created_at >= now() - interval '30 days')::integer,
    round(coalesce(sum(extract(epoch from (o.done_at - o.created_at)) / 3600)
      filter (where o.type = 'unplanned' and o.status <> 'cancelled' and o.done_at is not null
              and o.created_at >= now() - interval '30 days'), 0)::numeric, 1),
    count(*) filter (where o.status in ('issued', 'accepted', 'queued', 'in_progress', 'paused', 'rework'))::integer
  from work_orders o
  where app.auth_employee_id() is not null
    and o.equipment_id = p_equipment_id
$$;

revoke execute on function equipment_recent_stats(uuid) from public, anon;
grant execute on function equipment_recent_stats(uuid) to authenticated;
