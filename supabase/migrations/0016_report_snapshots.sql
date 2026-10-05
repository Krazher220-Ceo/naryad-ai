-- 0016_report_snapshots.sql — кэш отчётов и аналитики: считаем раз в сутки, а не при каждом открытии.
-- В строке лежит готовый результат отчёта (payload) и, если есть, текст ИИ (ai_text) с источником.
-- kind — вид отчёта (shift, rating, anomalies, dashboard, materials, downtime),
-- scope — период или смена («30», «2026-10-03:A»). Пара (kind, scope) уникальна.
-- Читают мастер и руководитель. Писать клиентам нельзя: запись только с серверным ключом
-- (service_role обходит правила доступа) из lib/analytics/snapshots.ts и маршрута /api/cron/reports.

create table report_snapshots (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  scope       text not null default '',
  payload     jsonb not null,
  ai_text     jsonb,
  ai_source   text,
  computed_at timestamptz not null default now(),
  unique (kind, scope)
);

alter table report_snapshots enable row level security;

create policy read_report_snapshots on report_snapshots
  for select to authenticated
  using (app.auth_role() in ('master', 'lead'));

-- Явно убираем права на запись: даже при ошибке в правилах клиент ничего не изменит.
revoke all on report_snapshots from anon, authenticated;
grant select on report_snapshots to authenticated;
